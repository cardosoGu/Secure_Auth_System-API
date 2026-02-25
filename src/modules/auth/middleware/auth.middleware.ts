import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '../../../lib/token.js';
import prisma from '#database';

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const accessToken = request.cookies['accessToken'];

  if (!accessToken) {
    return reply.status(401).send({ success: false, message: 'Unauthorized' });
  }

  try {
    const payload = verifyAccessToken(accessToken);

    // Fetch user and session
    const session = await prisma.session.findFirst({
      where: { userId: payload.sub },
      include: { user: true },
    });

    if (!session) {
      return reply.status(401).send({ success: false, message: 'Session not found' });
    }

    // Pass user and session to controllers
    request.user = { id: payload.sub, sessionId: session.id };
  } catch {
    return reply.status(401).send({ success: false, message: 'Invalid or expired token' });
  }
}
