import { NextResponse } from 'next/server';
import { requireAccountApi } from '@/lib/account-auth';
import {
  getSavedAddress,
  serializeSavedAddress,
} from '@/lib/account-addresses';
import { isValidAddressId, validateSavedAddressInput } from '@/lib/account-validation';
import { db } from '@/lib/db';
import { rateLimitActorAction } from '@/lib/rate-limit';

type RouteContext = { params: Promise<{ addressId: string }> };

function parseAddressId(value: string): number | null {
  if (!isValidAddressId(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { userId, response } = await requireAccountApi();
  if (response) return response;

  const rateLimitResponse = await rateLimitActorAction(userId, 'account-address-write', 20);
  if (rateLimitResponse) return rateLimitResponse;

  const { addressId: rawAddressId } = await params;
  const addressId = parseAddressId(rawAddressId);
  if (addressId === null) {
    return NextResponse.json({ error: 'Address not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validation = validateSavedAddressInput(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const input = validation.data;

  try {
    // Ownership and saved-vs-snapshot scoping are checked before any write.
    const existing = await getSavedAddress(userId, addressId);
    if (!existing) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    const address = await db.$transaction(async (tx) => {
      if (input.isDefaultShipping) {
        await tx.address.updateMany({
          where: {
            userId,
            orderId: null,
            isDefaultShipping: true,
            id: { not: addressId },
          },
          data: { isDefaultShipping: false },
        });
      }
      if (input.isDefaultBilling) {
        await tx.address.updateMany({
          where: {
            userId,
            orderId: null,
            isDefaultBilling: true,
            id: { not: addressId },
          },
          data: { isDefaultBilling: false },
        });
      }

      return tx.address.update({
        where: { id: addressId },
        data: {
          kind: input.kind,
          firstName: input.firstName,
          lastName: input.lastName,
          company: input.company,
          phone: input.phone,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2,
          landmark: input.landmark,
          city: input.city,
          state: input.state,
          postalCode: input.postalCode,
          country: input.country,
          isDefaultShipping: input.isDefaultShipping,
          isDefaultBilling: input.isDefaultBilling,
        },
        select: {
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
        },
      });
    });

    return NextResponse.json({ address: serializeSavedAddress(address) });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Another default address was set at the same time. Refresh and try again.' },
        { status: 409 },
      );
    }
    console.error('[PATCH /api/account/addresses/[addressId]]', error);
    return NextResponse.json({ error: 'Failed to update address' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { userId, response } = await requireAccountApi();
  if (response) return response;

  const rateLimitResponse = await rateLimitActorAction(userId, 'account-address-write', 20);
  if (rateLimitResponse) return rateLimitResponse;

  const { addressId: rawAddressId } = await params;
  const addressId = parseAddressId(rawAddressId);
  if (addressId === null) {
    return NextResponse.json({ error: 'Address not found' }, { status: 404 });
  }

  try {
    const existing = await getSavedAddress(userId, addressId);
    if (!existing) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    // Order address snapshots are a different table relationship and are never
    // touched by saved-address deletion.
    await db.address.delete({ where: { id: addressId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/account/addresses/[addressId]]', error);
    return NextResponse.json({ error: 'Failed to delete address' }, { status: 500 });
  }
}
