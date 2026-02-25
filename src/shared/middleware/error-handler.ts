import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  request.log.error(error);

  reply.status(error.statusCode ?? 500).send({
    status: 'error',
    message: error.message ?? 'Internal server error',
  });
}
