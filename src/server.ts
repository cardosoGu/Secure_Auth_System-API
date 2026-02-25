import 'dotenv/config';
import { buildApp } from './app.js';
import { env } from './config/env.js';

const banner = `
  ╔═══════════════════════════════════════╗
  ║           🔐 AUTH SERVICE             ║
  ╚═══════════════════════════════════════╝
`;

async function main() {
  const app = await buildApp();

  await app.listen({ port: env.PORT, host: '0.0.0.0' });

  console.log(banner);
  app.log.info(`🚀 Server running at http://localhost:${env.PORT}`);
  app.log.info(`📦 Environment: ${env.NODE_ENV}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
