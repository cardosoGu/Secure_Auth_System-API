import 'dotenv/config';
import Fastify, { FastifyError } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { env } from './config/env.js';
import { authRoutes } from './modules/auth/routes/auth.route.js';

export async function buildApp() {
  const app = Fastify({
    trustProxy: true,
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV !== 'production'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss.l',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
  });

  // Zod validation
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet);
  await app.register(cookie);

  // Routes
  await app.register(authRoutes, { prefix: '/api/auth' });

  // Error handler
  app.setErrorHandler((error: FastifyError, request, reply) => {
    app.log.error(error);
    reply.status(error.statusCode ?? 500).send({
      success: false,
      message: error.message ?? 'Internal server error',
    });
  });

  // 404 handler
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      success: false,
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  return app;
}
