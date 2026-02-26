import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { loginSchema, registerSchema, verifySchema } from '../schemas/auth.schema.js';
import { registerController } from '../controllers/registerController.js';
import { loginController } from '../controllers/loginController.js';
import { verifyController } from '../controllers/verifyController.js';
import { refreshController } from '../controllers/refreshController.js';
import { logoutController } from '../controllers/logoutController.js';
import { notLoggedMiddleware } from '../middleware/notLogged.middleware.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { rateLimitMiddleware } from '../../rateLimit/rateLimit.middleware.js';
import { meController } from '../controllers/meController.js';

export async function authRoutes(app: FastifyInstance) {
  //to zod type bodies
  const router = app.withTypeProvider<ZodTypeProvider>();

  router.post(
    '/register',
    {
      preHandler: [rateLimitMiddleware, notLoggedMiddleware],
      schema: { body: registerSchema },
    },
    registerController,
  );

  router.post(
    '/login',
    {
      preHandler: [rateLimitMiddleware, notLoggedMiddleware],
      schema: { body: loginSchema },
    },
    loginController,
  );

  router.post(
    '/verify',
    {
      preHandler: [rateLimitMiddleware, notLoggedMiddleware],
      schema: { body: verifySchema },
    },
    verifyController,
  );

  router.get('/me', { preHandler: authMiddleware }, meController);

  router.post('/refresh', { preHandler: [rateLimitMiddleware, authMiddleware] }, refreshController);
  router.post('/logout', { preHandler: authMiddleware }, logoutController);
}
