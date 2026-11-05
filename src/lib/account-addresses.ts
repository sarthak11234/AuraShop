import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

/** Only saved addresses have no order snapshot link. */
export const savedAddressSelect = {
  id: true,
  kind: true,
  firstName: true,
  lastName: true,
  company: true,
  phone: true,
  addressLine1: true,
  addressLine2: true,
  landmark: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  isDefaultShipping: true,
  isDefaultBilling: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AddressSelect;

export type SavedAddressRow = Prisma.AddressGetPayload<{ select: typeof savedAddressSelect }>;

export function serializeSavedAddress(address: SavedAddressRow) {
  return {
    ...address,
    createdAt: address.createdAt.toISOString(),
    updatedAt: address.updatedAt.toISOString(),
  };
}

export function getSavedAddresses(userId: string) {
  return db.address.findMany({
    where: { userId, orderId: null },
    select: savedAddressSelect,
    orderBy: [
      { isDefaultShipping: 'desc' },
      { isDefaultBilling: 'desc' },
      { updatedAt: 'desc' },
    ],
  });
}

export function getSavedAddress(userId: string, addressId: number) {
  return db.address.findFirst({
    where: { id: addressId, userId, orderId: null },
    select: savedAddressSelect,
  });
}
