import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export function generateAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): { sub: string } {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string };
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string };
}
export function parseExpiresInToMs(expiresIn: string): number {
  const unit = expiresIn.slice(-1);
  const value = parseInt(expiresIn.slice(0, -1));

  switch (unit) {
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'm':
      return value * 60 * 1000;
    case 's':
      return value * 1000;
    default:
      throw new Error(`Invalid expiresIn format: ${expiresIn}`);
  }
}
