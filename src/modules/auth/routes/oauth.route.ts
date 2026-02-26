import { FastifyInstance } from 'fastify';
import {
  googleRedirectController,
  googleCallbackController,
} from '../controllers/oauth/google/googleCallbackController';
import {
  githubCallbackController,
  githubRedirectController,
} from '../controllers/oauth/github/githubCallbackController';
import { notLoggedMiddleware } from '../middleware/notLogged.middleware';

export async function oauthRoutes(app: FastifyInstance) {
  app.get('/google', { preHandler: notLoggedMiddleware }, googleRedirectController);
  app.get('/google/callback', googleCallbackController);

  app.get('/github', { preHandler: notLoggedMiddleware }, githubRedirectController);
  app.get('/github/callback', githubCallbackController);
}
