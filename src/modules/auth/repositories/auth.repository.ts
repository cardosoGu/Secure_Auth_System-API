import prisma from '../../../lib/prisma.js';

// ===== USER =====
export async function findUniqueByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function createUser(data: { email: string; password: string; name: string }) {
  return prisma.user.create({ data: { ...data, email: data.email.toLowerCase() } });
}

export async function updateUserPassword(id: string, password: string) {
  return prisma.user.update({
    where: { id },
    data: { password },
  });
}

// ===== OAUTH =====
export async function createOAuthUser(data: {
  email: string;
  name: string;
  avatarUrl: string | null;
}) {
  return prisma.user.create({ data: { ...data, email: data.email.toLowerCase() } });
}

export async function findOAuthAccount(provider: string, providerId: string) {
  return prisma.oAuthAccount.findUnique({
    where: { provider_providerId: { provider, providerId } },
    include: { user: true },
  });
}

export async function createOAuthAccount(data: {
  userId: string;
  provider: string;
  providerId: string;
}) {
  return prisma.oAuthAccount.create({ data });
}

// ===== PENDING AUTH =====
export async function deletePendingAuthByEmail(email: string) {
  return prisma.pendingAuth.deleteMany({ where: { email } });
}

export async function createPendingAuth(data: {
  name: string;
  email: string;
  codeHash: string;
  passwordHash: string;
  expiresAt: Date;
}) {
  return prisma.pendingAuth.create({ data });
}

export async function findPendingAuthByEmail(email: string) {
  return prisma.pendingAuth.findFirst({ where: { email } });
}

export async function markPendingAuthAsUsed(id: string) {
  return prisma.pendingAuth.update({
    where: { id },
    data: { usedAt: new Date() },
  });
}

// ===== SESSION =====
export async function createSession(data: {
  userId: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  clientIp: string;
  userAgent: string;
}) {
  return prisma.session.create({ data });
}

export async function findSessionByRefreshToken(refreshToken: string) {
  return prisma.session.findUnique({ where: { refreshToken } });
}

export async function findSessionByUserId(userId: string) {
  return prisma.session.findFirst({ where: { userId } });
}

export async function updateSessionTokens(
  id: string,
  data: {
    refreshToken: string;
    refreshExpiresAt: Date;
  },
) {
  return prisma.session.update({ where: { id }, data });
}

export async function deleteSession(id: string) {
  return prisma.session.delete({ where: { id } });
}

// ===== ACTIVE LOG =====
export async function createActiveLog(data: {
  userId: string;
  action: string;
  clientIp: string;
  userAgent: string;
  status: string;
  reason?: string;
}) {
  return prisma.activeLog.create({ data });
}

// ===== RATE LIMIT =====
export async function findRateLimit(clientIp: string, route: string) {
  return prisma.rateLimit.findUnique({
    where: { clientIp_route: { clientIp, route } },
  });
}

export async function createRateLimit(data: { clientIp: string; route: string; expiresAt: Date }) {
  return prisma.rateLimit.create({ data: { ...data, hits: 1 } });
}

export async function incrementRateLimit(clientIp: string, route: string) {
  return prisma.rateLimit.update({
    where: { clientIp_route: { clientIp, route } },
    data: { hits: { increment: 1 } },
  });
}

export async function resetRateLimit(clientIp: string, route: string, expiresAt: Date) {
  return prisma.rateLimit.update({
    where: { clientIp_route: { clientIp, route } },
    data: { hits: 1, expiresAt },
  });
}
