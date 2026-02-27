import { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../../../../../config/env.js';
import {
  generateAccessToken,
  generateRefreshToken,
  parseExpiresInToMs,
} from '../../../../../lib/token.js';
import {
  findUniqueByEmail,
  createOAuthUser,
  createSession,
  createActiveLog,
  findOAuthAccount,
  createOAuthAccount,
} from '../../../repositories/auth.repository.js';
import { normalizeAvatarUrl } from '../../../utils/avatarUrl.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

type GoogleCallbackQuery = {
  code?: string;
  state?: string;
  error?: string;
};

// GET /api/auth/oauth/google
// Redireciona o usuário para a página de login do Google
export async function googleRedirectController(req: FastifyRequest, reply: FastifyReply) {
  // Gera um ID aleatório para proteger contra ataques CSRF
  // (alguém mal-intencionado não consegue forjar um callback)
  const state = crypto.randomUUID();

  // Salva o state num cookie temporário (10 min) para validar no callback
  reply.setCookie('google_oauth_state', state, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  });

  // Monta os parâmetros da URL de autorização do Google
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_CALLBACK_URL, // para onde o Google vai redirecionar após o login
    response_type: 'code', // queremos receber um "code" temporário
    scope: 'openid email profile', // dados que queremos acessar
    access_type: 'offline',
    prompt: 'select_account', // força o Google a mostrar a tela de seleção de conta
    state,
  });

  return reply.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}

// GET /api/auth/oauth/google/callback
// O Google redireciona o usuário de volta pra cá após o login
export async function googleCallbackController(
  req: FastifyRequest<{ Querystring: GoogleCallbackQuery }>,
  reply: FastifyReply,
) {
  try {
    const { code, state, error } = req.query;

    // Se o usuário cancelou ou ocorreu erro no Google
    if (error) {
      return reply.code(400).send({ success: false, message: `Google OAuth error: ${error}` });
    }

    // O Google sempre deve retornar um code
    if (!code) {
      return reply
        .code(400)
        .send({ success: false, message: 'Código de autorização não recebido.' });
    }

    // Validação CSRF — compara o state que voltou com o que foi salvo no cookie
    const storedState = req.cookies?.google_oauth_state;
    if (!storedState || !state || storedState !== state) {
      return reply.code(400).send({ success: false, message: 'State inválido.' });
    }

    // Troca o "code" temporário pelo access_token real
    // O code é de uso único e expira em segundos
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_CALLBACK_URL,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      return reply.code(500).send({ success: false, message: 'Erro ao autenticar com Google.' });
    }

    const { access_token } = (await tokenRes.json()) as { access_token: string };

    // Usa o access_token para buscar os dados do usuário no Google
    const userInfoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userInfoRes.ok) {
      return reply.code(500).send({ success: false, message: 'Erro ao obter dados do Google.' });
    }

    const googleUser = (await userInfoRes.json()) as {
      id: string;
      email: string;
      name: string;
      picture: string;
    };

    // Busca pelo OAuthAccount usando o ID do Google
    // Evita criar usuário duplicado se o mesmo já logou antes pelo Google
    const oauthAccount = await findOAuthAccount('google', googleUser.id);

    let isNew = false;
    // Se já tem OAuthAccount, usa o usuário vinculado
    // Senão, tenta encontrar pelo email (pode ser um usuário local)
    let user = oauthAccount?.user ?? (await findUniqueByEmail(googleUser.email.toLowerCase()));

    // Se não encontrou nenhum usuário, cria um novo
    if (!user) {
      isNew = true;
      user = await createOAuthUser({
        email: googleUser.email.toLowerCase(),
        name: googleUser.name,
        avatarUrl: normalizeAvatarUrl(googleUser.picture),
      });
    }

    // Se não tinha OAuthAccount (usuário novo ou usuário local), cria um
    // Isso vincula o provider Google ao usuário
    if (!oauthAccount) {
      await createOAuthAccount({
        userId: user.id,
        provider: 'google',
        providerId: googleUser.id,
      });
    }

    // Captura IP real mesmo atrás de proxy (Nginx, Cloudflare...)
    const clientIp =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string | undefined) ||
      req.ip ||
      'unknown';

    const userAgent = req.headers['user-agent'] ?? 'unknown';

    // Gera os tokens JWT
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);
    const refreshExpiresAt = new Date(Date.now() + parseExpiresInToMs(env.JWT_REFRESH_EXPIRES_IN));

    // Salva a sessão no banco com o refreshToken e metadados
    await createSession({ userId: user.id, refreshToken, refreshExpiresAt, clientIp, userAgent });

    // Registra a atividade no log (register se novo, login se existente)
    await createActiveLog({
      userId: user.id,
      action: isNew ? 'register' : 'login',
      clientIp,
      userAgent,
      status: 'success',
      reason: 'Google OAuth',
    });

    // Limpa o cookie do state pois já foi validado e não é mais necessário
    reply.clearCookie('google_oauth_state', { path: '/' });

    // Seta o accessToken em cookie httpOnly (inacessível ao JavaScript)
    // Dura 15 minutos — token de curta duração
    reply.setCookie('accessToken', accessToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 15,
    });

    // Seta o refreshToken em cookie httpOnly
    // Dura 7 dias — usado para renovar o accessToken
    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return reply.status(200).send({ success: true, message: 'Authenticated successfully' });
  } catch (error) {
    req.log.error({ err: error }, 'Erro no callback Google');
    return reply.code(500).send({ success: false, message: 'Erro interno.' });
  }
}
