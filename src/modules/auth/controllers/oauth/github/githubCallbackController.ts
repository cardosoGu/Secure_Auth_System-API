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
const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails';

type GithubCallbackQuery = {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
};

export async function githubRedirectController(req: FastifyRequest, reply: FastifyReply) {
  const state = crypto.randomUUID();

  reply.setCookie('github_oauth_state', state, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  });

  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: env.GITHUB_CALLBACK_URL,
    scope: 'read:user user:email',
    state,
  });

  return reply.redirect(`${GITHUB_AUTH_URL}?${params.toString()}`);
}

export async function githubCallbackController(
  req: FastifyRequest<{ Querystring: GithubCallbackQuery }>,
  reply: FastifyReply,
) {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      const msg = error_description
        ? `${error}: ${error_description}`
        : `GitHub OAuth error: ${error}`;
      return reply.code(400).send({ success: false, message: msg });
    }

    if (!code) {
      return reply
        .code(400)
        .send({ success: false, message: 'Código de autorização não recebido.' });
    }

    const storedState = req.cookies?.github_oauth_state;
    if (!storedState || !state || storedState !== state) {
      return reply.code(400).send({ success: false, message: 'State inválido.' });
    }

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

    const headers = {
      Authorization: `Bearer ${access_token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    };

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

    if (!githubUser.email) {
      const emailsRes = await fetch(GITHUB_EMAILS_URL, { headers });

      if (emailsRes.ok) {
        const emails = (await emailsRes.json()) as Array<{
          email: string;
          primary: boolean;
          verified: boolean;
        }>;

        const primary =
          emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.primary);
        githubUser = { ...githubUser, email: primary?.email ?? null };
      }
    }

    if (!githubUser.email) {
      return reply
        .code(400)
        .send({ success: false, message: 'Não foi possível obter email do GitHub.' });
    }

    // Busca pelo OAuthAccount primeiro
    const oauthAccount = await findOAuthAccount('github', githubUser.id.toString());

    let isNew = false;
    let user = oauthAccount?.user ?? (await findUniqueByEmail(githubUser.email));

    if (!user) {
      isNew = true;
      user = await createOAuthUser({
        email: githubUser.email,
        name: githubUser.name ?? githubUser.login,
        avatarUrl: normalizeAvatarUrl(githubUser.avatar_url),
      });
    }

    if (!oauthAccount) {
      await createOAuthAccount({
        userId: user.id,
        provider: 'github',
        providerId: githubUser.id.toString(),
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
      reason: 'GitHub OAuth',
    });

    reply.clearCookie('github_oauth_state', { path: '/' });

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
    req.log.error({ err: error }, 'Erro no callback GitHub');
    return reply.code(500).send({ success: false, message: 'Erro interno.' });
  }
}
