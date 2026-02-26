import { FastifyReply, FastifyRequest } from 'fastify';
import { LoginInput } from '../schemas/auth.schema.js';
import { findUniqueByEmail } from '../repositories/auth.repository.js';
import { comparePassword } from '../../../lib/hash.js';
import { createVerificationCode } from '../services/auth.createVerificationCode.js';
import { verificationCodeTemplate } from '../../../lib/emailTemplate.js';
import { env } from '../../../config/env.js';
import { mailer } from '../../../lib/mailer.js';

export async function loginController(
  req: FastifyRequest<{ Body: LoginInput }>,
  reply: FastifyReply,
) {
  const { email, password } = req.body;

  const user = await findUniqueByEmail(email);
  if (!user) {
    return reply.status(401).send({ success: false, message: 'User not Found' });
  }

  if (!user.password) {
    const code = await createVerificationCode(email, password, user.name);

    await mailer.sendMail({
      from: env.SMTP_USER,
      to: email,
      subject: 'Verification code',
      html: verificationCodeTemplate(code),
    });

    return reply.status(200).send({ success: true, message: 'Verification code sent to email' });
  }

  const passwordMatch = await comparePassword(password, user.password);
  if (!passwordMatch) {
    return reply.status(401).send({ success: false, message: 'Invalid credentials' });
  }

  const code = await createVerificationCode(email, password, user.name);

  await mailer.sendMail({
    from: env.SMTP_USER,
    to: email,
    subject: 'Verification code',
    html: verificationCodeTemplate(code),
  });

  return reply.status(200).send({ success: true, message: 'Verification code sent to email' });
}
