import { FastifyRequest, FastifyReply } from 'fastify';
import {
  findRateLimit,
  createRateLimit,
  incrementRateLimit,
  resetRateLimit,
} from '../auth/repositories/auth.repository';

const RATE_LIMIT_CONFIG: Record<string, { maxHits: number; windowMs: number }> = {
  '/api/auth/register': { maxHits: 5, windowMs: 60 * 60 * 1000 },
  '/api/auth/login': { maxHits: 10, windowMs: 60 * 60 * 1000 },
  '/api/auth/verify': { maxHits: 5, windowMs: 60 * 60 * 1000 },
  '/api/auth/refresh': { maxHits: 30, windowMs: 60 * 60 * 1000 },
};

export async function rateLimitMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const route = request.routeOptions.url ?? request.url;
  const config = RATE_LIMIT_CONFIG[route];

  if (!config) return;

  const clientIp = request.ip;
  const now = new Date();

  const existing = await findRateLimit(clientIp, route);

  let hits = 1;

  if (!existing) {
    await createRateLimit({
      clientIp,
      route,
      expiresAt: new Date(now.getTime() + config.windowMs),
    });
  } else if (existing.expiresAt < now) {
    await resetRateLimit(clientIp, route, new Date(now.getTime() + config.windowMs));
  } else {
    const updated = await incrementRateLimit(clientIp, route);
    hits = updated.hits;
  }

  if (hits > config.maxHits) {
    const retryAfter = Math.ceil((existing!.expiresAt.getTime() - now.getTime()) / 1000);
    return reply.status(429).send({
      success: false,
      message: 'Too many requests. Try again later.',
      retryAfter,
    });
  }
}
