import { compareCode } from '../../../lib/hash.js';
import { findPendingAuthByEmail, markPendingAuthAsUsed } from '../repositories/auth.repository.js';

export async function validateVerificationCode(email: string, code: string) {
  const pendingAuth = await findPendingAuthByEmail(email);

  if (!pendingAuth) {
    return { success: false, message: 'Code not found' };
  }

  if (pendingAuth.usedAt) {
    return { success: false, message: 'Code already used' };
  }

  if (pendingAuth.expiresAt < new Date()) {
    return { success: false, message: 'Code expired' };
  }

  const codeMatch = await compareCode(code, pendingAuth.codeHash);
  if (!codeMatch) {
    return { success: false, message: 'Invalid code' };
  }

  await markPendingAuthAsUsed(pendingAuth.id);

  return { success: true, pendingAuth };
}
