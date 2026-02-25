import { FastifyReply, FastifyRequest } from 'fastify';

export function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  reply.status(404).send({
    status: 'error',
    message: `Rota ${request.method} ${request.url} não encontrada`,
  });
}
