import type { Role } from '@prisma/client';

export type AdminRole = Extract<Role, 'ADMIN' | 'SUPER_ADMIN'>;

export function isAdminRole(role: unknown): role is AdminRole {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export function hasAdminPermission(role: AdminRole, requiredRole: AdminRole = 'ADMIN') {
  return requiredRole === 'ADMIN' || role === 'SUPER_ADMIN';
}
