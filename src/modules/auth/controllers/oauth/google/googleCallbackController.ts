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

export async function googleRedirectController(req: FastifyRequest, reply: FastifyReply) {
  const state = crypto.randomUUID();

  reply.setCookie('google_oauth_state', state, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  });

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_CALLBACK_URL,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state,
  });

  return reply.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}

export async function googleCallbackController(
  req: FastifyRequest<{ Querystring: GoogleCallbackQuery }>,
  reply: FastifyReply,
) {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return reply.code(400).send({ success: false, message: `Google OAuth error: ${error}` });
    }

    if (!code) {
      return reply.code(400).send({ success: false, message: 'Código de autorização não recebido.' });
    }

    const storedState = req.cookies?.google_oauth_state;
    if (!storedState || !state || storedState !== state) {
      return reply.code(400).send({ success: false, message: 'State inválido.' });
    }

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

    // Busca pelo OAuthAccount primeiro
    const oauthAccount = await findOAuthAccount('google', googleUser.id);

    let isNew = false;
    let user = oauthAccount?.user ?? (await findUniqueByEmail(googleUser.email));

    if (!user) {
      isNew = true;
      user = await createOAuthUser({
        email: googleUser.email,
        name: googleUser.name,
        avatarUrl: normalizeAvatarUrl(googleUser.picture),
      });
    }

    if (!oauthAccount) {
      await createOAuthAccount({
        userId: user.id,
        provider: 'google',
        providerId: googleUser.id,
      });
    }

    const clientIp =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string | undefined) ||
      req.ip ||
      'unknown';

    const userAgent = req.headers['user-agent'] ?? 'unknown';

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);
    const refreshExpiresAt = new Date(Date.now() + parseExpiresInToMs(env.JWT_REFRESH_EXPIRES_IN));

    await createSession({ userId: user.id, refreshToken, refreshExpiresAt, clientIp, userAgent });

    await createActiveLog({
      userId: user.id,
      action: isNew ? 'register' : 'login',
      clientIp,
      userAgent,
      status: 'success',
      reason: 'Google OAuth',
    });

    reply.clearCookie('google_oauth_state', { path: '/' });

    reply.setCookie('accessToken', accessToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 15,
    });

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