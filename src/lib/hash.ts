import bcrypt from 'bcrypt';
import crypto from 'crypto';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string) {
  return await bcrypt.compare(password, hash);
}

export function generateCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function hashCode(code: string) {
  return await bcrypt.hash(code, SALT_ROUNDS);
}

export async function compareCode(code: string, hash: string) {
  return await bcrypt.compare(code, hash);
}
