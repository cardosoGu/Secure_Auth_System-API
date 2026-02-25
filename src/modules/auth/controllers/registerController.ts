import { FastifyReply, FastifyRequest } from 'fastify';
import { RegisterInput } from '../schemas/auth.schema.js';
import { findUniqueByEmail } from '../repositories/auth.repository.js';
import { createVerificationCode } from '../services/auth.createVerificationCode.js';
import { verificationCodeTemplate } from '../../../lib/emailTemplate.js';
import { env } from '../../../config/env.js';
import { mailer } from '../../../lib/mailer.js';

export async function registerController(
  req: FastifyRequest<{ Body: RegisterInput }>,
  reply: FastifyReply,
) {
  const { email, password, name } = req.body;

  const user = await findUniqueByEmail(email);
  if (user) {
    return reply.status(403).send({ success: false, message: 'Email already registered' });
  }

  const code = await createVerificationCode(email, password, name);

  await mailer.sendMail({
    from: env.SMTP_USER,
    to: email,
    subject: 'Verification code',
    html: verificationCodeTemplate(code),
  });

  return reply.status(201).send({ success: true, message: 'Verification code sent to email' });
}
