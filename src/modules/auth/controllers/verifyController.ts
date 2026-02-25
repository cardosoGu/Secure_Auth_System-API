import { FastifyRequest, FastifyReply } from 'fastify';
import { VerifyInput } from '../schemas/auth.schema.js';
import { validateVerificationCode } from '../services/auth.validateVerificationCode.js';
import {
  findUniqueByEmail,
  createUser,
  createSession,
  createActiveLog,
} from '../repositories/auth.repository.js';
import {
  generateAccessToken,
  generateRefreshToken,
  parseExpiresInToMs,
} from '../../../lib/token.js';
import { env } from '../../../config/env.js';

export async function verifyController(
  req: FastifyRequest<{ Body: VerifyInput }>,
  reply: FastifyReply,
) {
  const { email, code } = req.body;

  const validation = await validateVerificationCode(email, code);
  if (!validation.success || !validation.pendingAuth) {
    return reply.status(401).send({ success: false, message: validation.message });
  }

  const { pendingAuth } = validation;
  const clientIp = req.ip;
  const userAgent = req.headers['user-agent'] ?? 'unknown';

  const existingUser = await findUniqueByEmail(email);
  const isNewRegistration = !existingUser;

  let user = existingUser;

  if (isNewRegistration) {
    user = await createUser({
      email,
      password: pendingAuth.passwordHash,
      name: email.split('@')[0],
    });
  }

  const accessToken = generateAccessToken(user!.id);
  const refreshToken = generateRefreshToken(user!.id);
  const refreshExpiresAt = new Date(Date.now() + parseExpiresInToMs(env.JWT_REFRESH_EXPIRES_IN));

  await createSession({
    userId: user!.id,
    refreshToken,
    refreshExpiresAt,
    clientIp,
    userAgent,
  });

  await createActiveLog({
    userId: user!.id,
    action: isNewRegistration ? 'register' : 'login',
    clientIp,
    userAgent,
    status: 'success',
  });

  reply.setCookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  reply.setCookie('accessToken', accessToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 15,
  });

  return reply.status(200).send({ success: true, message: 'Authenticated successfully' });
}
