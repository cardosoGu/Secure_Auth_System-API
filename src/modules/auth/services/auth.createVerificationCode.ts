import { generateCode, hashCode, hashPassword } from '../../../lib/hash.js';
import { deletePendingAuthByEmail, createPendingAuth } from '../repositories/auth.repository.js';

const CODE_EXPIRES_MS = 15 * 60 * 1000;

export async function createVerificationCode(
  email: string,
  password: string,
  name: string,
): Promise<string> {
  await deletePendingAuthByEmail(email);

  const code = generateCode();

  const [codeHash, passwordHash] = await Promise.all([hashCode(code), hashPassword(password)]);

  await createPendingAuth({
    name,
    email,
    codeHash,
    passwordHash,
    expiresAt: new Date(Date.now() + CODE_EXPIRES_MS),
  });

  return code;
}
