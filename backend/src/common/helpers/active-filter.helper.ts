import { Prisma } from '@prisma/client';

/**
 * Shared active coupon source filter used across repositories and services.
 * Returns a fresh filter object each call (Date must be evaluated at query time).
 */
export function getActiveFilter(): Prisma.CouponSourceWhereInput {
  return {
    isActive: true,
    isFree: true,
    OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
  };
}
