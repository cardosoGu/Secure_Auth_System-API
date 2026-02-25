import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken, verifyRefreshToken } from '../../../lib/token';

export async function notLoggedMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const accessToken = request.cookies['accessToken'];
  const refreshToken = request.cookies['refreshToken'];

  // if tokens = null, pass
  if (!accessToken && !refreshToken) return;

  // verifica accessToken
  if (accessToken) {
    try {
      verifyAccessToken(accessToken);
      return reply.status(400).send({
        status: 'error',
        message: 'Você já está autenticado',
      });
    } catch {
      // if access = expiresd, verify refresh token
    }
  }

  // verificy refreshToken
  if (refreshToken) {
    try {
      verifyRefreshToken(refreshToken);
      return reply.status(400).send({
        status: 'error',
        message: 'Você já está autenticado',
      });
    } catch {
      // refreshToken also expirec, pass
    }
  }
}
