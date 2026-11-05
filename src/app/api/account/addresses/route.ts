import { NextResponse } from 'next/server';
import { requireAccountApi } from '@/lib/account-auth';
import {
  getSavedAddresses,
  serializeSavedAddress,
} from '@/lib/account-addresses';
import {
  MAX_SAVED_ADDRESSES,
  validateSavedAddressInput,
} from '@/lib/account-validation';
import { db } from '@/lib/db';
import { rateLimitActorAction } from '@/lib/rate-limit';

export async function GET() {
  const { userId, response } = await requireAccountApi();
  if (response) return response;

  try {
    const addresses = await getSavedAddresses(userId);
    return NextResponse.json({ addresses: addresses.map(serializeSavedAddress) });
  } catch (error) {
    console.error('[GET /api/account/addresses]', error);
    return NextResponse.json({ error: 'Failed to load addresses' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { userId, response } = await requireAccountApi();
  if (response) return response;

  const rateLimitResponse = await rateLimitActorAction(userId, 'account-address-write', 20);
  if (rateLimitResponse) return rateLimitResponse;

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
    const outcome = await db.$transaction(async (tx) => {
      const count = await tx.address.count({ where: { userId, orderId: null } });
      if (count >= MAX_SAVED_ADDRESSES) return { kind: 'limit' as const };

      // The first saved address becomes the default for both categories so a
      // customer always has a usable default after adding one address.
      const isFirstAddress = count === 0;
      const isDefaultShipping = isFirstAddress || input.isDefaultShipping;
      const isDefaultBilling = isFirstAddress || input.isDefaultBilling;

      if (isDefaultShipping) {
        await tx.address.updateMany({
          where: { userId, orderId: null, isDefaultShipping: true },
          data: { isDefaultShipping: false },
        });
      }
      if (isDefaultBilling) {
        await tx.address.updateMany({
          where: { userId, orderId: null, isDefaultBilling: true },
          data: { isDefaultBilling: false },
        });
      }

      const address = await tx.address.create({
        data: {
          userId,
          orderId: null,
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
          isDefaultShipping,
          isDefaultBilling,
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

      return { kind: 'created' as const, address };
    });

    if (outcome.kind === 'limit') {
      return NextResponse.json(
        { error: `You can save up to ${MAX_SAVED_ADDRESSES} addresses.` },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { address: serializeSavedAddress(outcome.address) },
      { status: 201 },
    );
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
    console.error('[POST /api/account/addresses]', error);
    return NextResponse.json({ error: 'Failed to save address' }, { status: 500 });
  }
}
