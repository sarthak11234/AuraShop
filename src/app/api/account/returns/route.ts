import { NextResponse } from 'next/server';
import { requireAccountApi } from '@/lib/account-auth';
import { createReturnRequest } from '@/lib/return-service';
import { db } from '@/lib/db';
import { ReturnReason, ReturnStatus, ReturnType, Prisma } from '@prisma/client';
import {
  renderReturnRequestedEmailHtml,
  renderReturnRequestedEmailText,
  sendEmail,
  emailSubject,
} from '@/lib/email';

const ALLOWED_REASONS: ReturnReason[] = [
  'WRONG_SIZE',
  'WRONG_PRODUCT',
  'DAMAGED',
  'DEFECTIVE',
  'DIFFERS_FROM_DESCRIPTION',
  'QUALITY_ISSUE',
  'OTHER',
];

const ALLOWED_TYPES: ReturnType[] = ['REFUND', 'EXCHANGE'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** GET /api/account/returns — list the customer's return requests. */
export async function GET(request: Request) {
  const { userId, response } = await requireAccountApi();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const page = Math.max(
    1,
    Number.parseInt(searchParams.get('page') ?? '1', 10) || 1,
  );
  const pageSize = Math.min(
    50,
    Math.max(1, Number.parseInt(searchParams.get('pageSize') ?? '20', 10) || 20),
  );
  const status = searchParams.get('status');
  const validatedStatus =
    status && Object.values(ReturnStatus).includes(status as ReturnStatus)
      ? (status as ReturnStatus)
      : undefined;

  try {
    const [returns, total] = await Promise.all([
      dbReturnList({ userId, status: validatedStatus, page, pageSize }),
      dbReturnCount({ userId, status: validatedStatus }),
    ]);

    return NextResponse.json({
      returns,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error('[GET /api/account/returns]', error);
    return NextResponse.json({ error: 'Failed to load returns' }, { status: 500 });
  }
}

async function dbReturnList({
  userId,
  status,
  page,
  pageSize,
}: {
  userId: string;
  status?: ReturnStatus;
  page: number;
  pageSize: number;
}) {
  return db.returnRequest.findMany({
    where: { userId, ...(status ? { status } : {}) },
    include: {
      order: { select: { orderNumber: true, status: true } },
      items: {
        select: {
          id: true,
          productTitle: true,
          requestedQuantity: true,
          approvedQuantity: true,
          price: true,
        },
      },
      events: {
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { status: true, title: true, createdAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
}

async function dbReturnCount({
  userId,
  status,
}: {
  userId: string;
  status?: ReturnStatus;
}) {
  return db.returnRequest.count({ where: { userId, ...(status ? { status } : {}) } });
}

/** POST /api/account/returns — create a new return request. */
export async function POST(request: Request) {
  const { userId, response } = await requireAccountApi();
  if (response) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const orderId = readString(body.orderId);
  const returnReason = readString(body.returnReason);
  const returnType = readString(body.returnType);
  const customerComments = readString(body.customerComments) || null;

  if (!orderId) {
    return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
  }
  if (!ALLOWED_REASONS.includes(returnReason as ReturnReason)) {
    return NextResponse.json({ error: 'Invalid return reason' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(returnType as ReturnType)) {
    return NextResponse.json({ error: 'Invalid return type' }, { status: 400 });
  }

  const rawItems = body.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return NextResponse.json(
      { error: 'At least one item must be selected' },
      { status: 400 },
    );
  }

  const items: Array<{ orderItemId: number; quantity: number }> = [];
  for (const raw of rawItems) {
    if (!isRecord(raw)) {
      return NextResponse.json({ error: 'Invalid item' }, { status: 400 });
    }
    const orderItemId = Number(raw.orderItemId);
    const quantity = Number(raw.quantity);
    if (!Number.isInteger(orderItemId) || orderItemId < 1) {
      return NextResponse.json({ error: 'Invalid order item ID' }, { status: 400 });
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 });
    }
    items.push({ orderItemId, quantity });
  }

  try {
    const result = await createReturnRequest({
      userId,
      input: {
        orderId,
        returnReason,
        returnType: returnType as 'REFUND' | 'EXCHANGE',
        customerComments,
        items,
      },
    });

    if (result.kind === 'not-eligible') {
      return NextResponse.json({ error: result.reasons.join(' ') }, { status: 400 });
    }
    if (result.kind === 'not-found') {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (result.kind === 'conflict') {
      return NextResponse.json(
        { error: 'An active return request already exists for this order' },
        { status: 409 },
      );
    }

    if (result.kind === 'created') {
      // Fire-and-forget: send return request confirmation email
      void sendReturnRequestedEmail({
        userId,
        returnRequest: result.returnRequest,
      });
      return NextResponse.json(
        { returnRequest: result.returnRequest },
        { status: 201 },
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Too many')) {
      return NextResponse.json(
        { error: error.message },
        { status: 429 },
      );
    }
    console.error('[POST /api/account/returns]', error);
    return NextResponse.json({ error: 'Failed to create return request' }, { status: 500 });
  }
}

// Send return request email after successful creation (fire-and-forget)
async function sendReturnRequestedEmail({
  userId,
  returnRequest,
}: {
  userId: string;
  returnRequest: Prisma.ReturnRequestGetPayload<{
    include: { items: true };
  }>;
}) {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    if (!user?.email) return;

    const order = await db.order.findUnique({
      where: { id: returnRequest.orderId },
      select: { orderNumber: true },
    });
    if (!order) return;

    const items = await db.returnItem.findMany({
      where: { returnRequestId: returnRequest.id },
      select: { productTitle: true, requestedQuantity: true },
    });

    await sendEmail({
      to: user.email,
      subject: emailSubject(`Return request received — ${returnRequest.returnNumber}`),
      html: renderReturnRequestedEmailHtml({
        returnNumber: returnRequest.returnNumber,
        orderNumber: order.orderNumber,
        customerName: user.name,
        items: items.map((item) => ({
          productTitle: item.productTitle,
          requestedQuantity: item.requestedQuantity,
        })),
        returnReason: returnRequest.returnReason,
        requestedAt: returnRequest.requestedAt,
        appUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      }),
      text: renderReturnRequestedEmailText({
        returnNumber: returnRequest.returnNumber,
        orderNumber: order.orderNumber,
        customerName: user.name,
        items: items.map((item) => ({
          productTitle: item.productTitle,
          requestedQuantity: item.requestedQuantity,
        })),
        returnReason: returnRequest.returnReason,
        requestedAt: returnRequest.requestedAt,
        appUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      }),
    });
  } catch (error) {
    // Email delivery failure must not block the return request
    console.error('[sendReturnRequestedEmail]', error);
  }
}
