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

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USERINFO_URL = 'https://api.github.com/user';
const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails'; // necessário para emails privados

type GithubCallbackQuery = {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
};

// GET /api/auth/oauth/github
// Redireciona o usuário para a página de autorização do GitHub
export async function githubRedirectController(req: FastifyRequest, reply: FastifyReply) {
  // Gera um ID aleatório para proteger contra ataques CSRF
  const state = crypto.randomUUID();

  // Salva o state num cookie temporário (10 min) para validar no callback
  reply.setCookie('github_oauth_state', state, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  });

  // Monta os parâmetros da URL de autorização do GitHub
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: env.GITHUB_CALLBACK_URL, // para onde o GitHub vai redirecionar após autorizar
    scope: 'read:user user:email', // dados que queremos acessar (perfil e email)
    state,
  });

  return reply.redirect(`${GITHUB_AUTH_URL}?${params.toString()}`);
}

// GET /api/auth/oauth/github/callback
// O GitHub redireciona o usuário de volta pra cá após autorizar
export async function githubCallbackController(
  req: FastifyRequest<{ Querystring: GithubCallbackQuery }>,
  reply: FastifyReply,
) {
  try {
    const { code, state, error, error_description } = req.query;

    // Se o usuário cancelou ou ocorreu erro no GitHub
    if (error) {
      const msg = error_description
        ? `${error}: ${error_description}`
        : `GitHub OAuth error: ${error}`;
      return reply.code(400).send({ success: false, message: msg });
    }

    // O GitHub sempre deve retornar um code
    if (!code) {
      return reply
        .code(400)
        .send({ success: false, message: 'Código de autorização não recebido.' });
    }

    // Validação CSRF — compara o state que voltou com o que foi salvo no cookie
    const storedState = req.cookies?.github_oauth_state;
    if (!storedState || !state || storedState !== state) {
      return reply.code(400).send({ success: false, message: 'State inválido.' });
    }

    // Troca o "code" temporário pelo access_token real
    const tokenRes = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: env.GITHUB_CALLBACK_URL,
      }),
    });

    if (!tokenRes.ok) {
      return reply.code(500).send({ success: false, message: 'Erro ao autenticar com GitHub.' });
    }

    const { access_token } = (await tokenRes.json()) as { access_token: string };

    // Headers reutilizados nas próximas chamadas à API do GitHub
    const headers = {
      Authorization: `Bearer ${access_token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    };

    // Busca os dados do perfil do usuário no GitHub
    const userInfoRes = await fetch(GITHUB_USERINFO_URL, { headers });

    if (!userInfoRes.ok) {
      return reply.code(500).send({ success: false, message: 'Erro ao obter dados do GitHub.' });
    }

    let githubUser = (await userInfoRes.json()) as {
      id: number;
      login: string;
      name: string | null;
      email: string | null;
      avatar_url: string | null;
    };

    // Muitos usuários do GitHub têm o email configurado como privado
    // Nesse caso o email não vem no perfil — precisamos buscar na lista de emails
    if (!githubUser.email) {
      const emailsRes = await fetch(GITHUB_EMAILS_URL, { headers });

      if (emailsRes.ok) {
        const emails = (await emailsRes.json()) as Array<{
          email: string;
          primary: boolean;
          verified: boolean;
        }>;

        // Prioriza o email primário e verificado
        const primary =
          emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.primary);
        githubUser = { ...githubUser, email: primary?.email ?? null };
      }
    }

    // Se mesmo assim não conseguimos um email, não podemos criar o usuário
    if (!githubUser.email) {
      return reply.code(400).send({
        success: false,
        message: 'Não foi possível obter email do GitHub.',
      });
    }

    // Busca pelo OAuthAccount usando o ID do GitHub
    // Evita criar usuário duplicado se o mesmo já logou antes pelo GitHub
    const oauthAccount = await findOAuthAccount('github', githubUser.id.toString());

    let isNew = false;
    // Se já tem OAuthAccount, usa o usuário vinculado
    // Senão, tenta encontrar pelo email (pode ser um usuário local)
    let user = oauthAccount?.user ?? (await findUniqueByEmail(githubUser.email.toLowerCase()));

    // Se não encontrou nenhum usuário, cria um novo
    if (!user) {
      isNew = true;
      user = await createOAuthUser({
        email: githubUser.email.toLowerCase(),
        name: githubUser.name ?? githubUser.login, // login é o @ do GitHub, fallback se não tiver name
        avatarUrl: normalizeAvatarUrl(githubUser.avatar_url),
      });
    }

    // Se não tinha OAuthAccount (usuário novo ou usuário local), cria um
    // Isso vincula o provider GitHub ao usuário
    if (!oauthAccount) {
      await createOAuthAccount({
        userId: user.id,
        provider: 'github',
        providerId: githubUser.id.toString(),
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
      reason: 'GitHub OAuth',
    });

    // Limpa o cookie do state pois já foi validado e não é mais necessário
    reply.clearCookie('github_oauth_state', { path: '/' });

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
    req.log.error({ err: error }, 'Erro no callback GitHub');
    return reply.code(500).send({ success: false, message: 'Erro interno.' });
  }
}
