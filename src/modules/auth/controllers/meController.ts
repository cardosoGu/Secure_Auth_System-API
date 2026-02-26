import { FastifyReply, FastifyRequest } from 'fastify';
import { findSessionByUserId } from '../repositories/auth.repository';
import prisma from '#database';
import { Session } from 'node:inspector';

export async function meController(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.user;

  const user = await prisma.user.findUnique({
    where: { id },
    include: { sessions: true, activeLogs: true, oauthAccounts: true },
  });
  return reply.status(200).send(user);
}
