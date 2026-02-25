import { FastifyRequest, FastifyReply } from 'fastify';
import { deleteSession } from '../repositories/auth.repository.js';

export async function logoutController(req: FastifyRequest, reply: FastifyReply) {
  const { sessionId } = req.user;

  await deleteSession(sessionId);

  reply.clearCookie('accessToken', { path: '/' });
  reply.clearCookie('refreshToken', { path: '/' });

  return reply.status(200).send({ success: true, message: 'Logged out successfully' });
}
