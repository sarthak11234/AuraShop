import { randomUUID } from 'node:crypto';
import { OrderStatus } from '@prisma/client';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { isRazorpayConfigured } from '@/lib/payment';
import { canAccessOrder, hashCheckoutToken } from '@/lib/order-access';
import {
  calculateCheckoutTotals,
  isValidCheckoutEmail,
  isValidCheckoutName,
  isValidCheckoutPhone,
  normalizeCheckoutAddress,
} from '@/lib/checkout-rules';

class CheckoutConflict extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function responseForOrder(order: {
  id: string;
  orderNumber: string;
  subtotal: unknown;
  discount: unknown;
  shipping: unknown;
  tax: unknown;
  total: unknown;
  currency: string;
  status: OrderStatus;
  paymentStatus: string;
  payment: { provider: string } | null;
}) {
  return {
    success: true,
    orderId: order.id,
    orderNumber: order.orderNumber,
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    shipping: Number(order.shipping),
    tax: Number(order.tax),
    total: Number(order.total),
    currency: order.currency,
    paymentMethod: order.payment?.provider ?? 'unknown',
    status: order.status,
    paymentStatus: order.paymentStatus,
  };
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!isRecord(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const idempotencyKey = request.headers.get('Idempotency-Key')?.trim() ?? '';
    const checkoutToken = request.headers.get('X-Checkout-Token')?.trim() ?? '';
    if (!isUuid(idempotencyKey) || !isUuid(checkoutToken)) {
      return NextResponse.json(
        { error: 'A valid checkout idempotency key and access token are required' },
        { status: 400 },
      );
    }

    const session = await auth();
    const userId = session?.user?.id ?? null;
    const checkoutTokenHash = hashCheckoutToken(checkoutToken);
    const paymentMethod = body.paymentMethod === undefined ? 'cod' : body.paymentMethod;
    if (paymentMethod !== 'cod' && paymentMethod !== 'razorpay') {
      return NextResponse.json({ error: 'Unsupported payment method' }, { status: 400 });
    }
    const existingOrder = await db.order.findUnique({
      where: { idempotencyKey },
      include: { payment: true },
    });
    if (existingOrder) {
      if (!canAccessOrder(existingOrder, userId, checkoutToken)) {
        return NextResponse.json({ error: 'Checkout key is already associated with another order' }, { status: 409 });
      }
      if (existingOrder.payment?.provider !== paymentMethod) {
        return NextResponse.json({ error: 'Payment method changed after this checkout was submitted. Start a new checkout.' }, { status: 409 });
      }
      return NextResponse.json(responseForOrder(existingOrder));
    }

    if (paymentMethod === 'razorpay' && !isRazorpayConfigured()) {
      return NextResponse.json(
        { error: 'Online payment is unavailable because the Razorpay gateway is not configured. Choose Cash on Delivery.' },
        { status: 503 },
      );
    }

    const customer = isRecord(body.customerInfo) ? body.customerInfo : {};
    const emailFromSession = session?.user?.email?.trim() ?? '';
    const email = emailFromSession || (typeof customer.email === 'string' ? customer.email.trim() : '');
    const firstName = typeof customer.firstName === 'string' ? customer.firstName.trim() : '';
    const lastName = typeof customer.lastName === 'string' ? customer.lastName.trim() : '';
    const phone = typeof customer.phone === 'string' ? customer.phone.trim() : '';

    if (!isValidCheckoutEmail(email)) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }
    if (!isValidCheckoutName(firstName) || !isValidCheckoutName(lastName)) {
      return NextResponse.json({ error: 'First and last name must be between 2 and 64 characters' }, { status: 400 });
    }
    if (!isValidCheckoutPhone(phone)) {
      return NextResponse.json({ error: 'Valid phone number is required (10-20 digits)' }, { status: 400 });
    }

    const shippingAddress = normalizeCheckoutAddress(body.shippingAddress, phone);
    if (!shippingAddress) {
      return NextResponse.json({ error: 'Enter a valid shipping name, street address, city, and postal code' }, { status: 400 });
    }

    const rawItems = body.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 50) {
      return NextResponse.json({ error: 'Cart must contain between 1 and 50 items' }, { status: 400 });
    }

    const validatedItems: Array<{
      product: { id: string; title: string; slug: string; images: unknown };
      variant: { id: string; size: string; stock: number };
      quantity: number;
      unitPriceCents: number;
      lineTotalCents: number;
    }> = [];
    const lineKeys = new Set<string>();

    for (const rawItem of rawItems) {
      if (!isRecord(rawItem)) {
        return NextResponse.json({ error: 'Invalid product in cart' }, { status: 400 });
      }
      const productId = typeof rawItem.productId === 'string' ? rawItem.productId.trim() : '';
      const size = typeof rawItem.size === 'string' ? rawItem.size.trim() : '';
      const quantity = rawItem.quantity;
      if (
        !productId ||
        productId.length > 64 ||
        !/^[A-Za-z0-9\s._/&+()-]{1,32}$/.test(size) ||
        typeof quantity !== 'number' ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        quantity > 100
      ) {
        return NextResponse.json({ error: 'Invalid product, size, or item quantity' }, { status: 400 });
      }

      const lineKey = `${productId}:${size}`;
      if (lineKeys.has(lineKey)) {
        return NextResponse.json({ error: 'Duplicate product variants are not allowed in the cart' }, { status: 400 });
      }
      lineKeys.add(lineKey);

      const product = await db.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          title: true,
          slug: true,
          images: true,
          price: true,
          isPublished: true,
          archivedAt: true,
          categoryRecord: { select: { isPublished: true } },
        },
      });
      if (!product || !product.isPublished || product.archivedAt || !product.categoryRecord?.isPublished) {
        return NextResponse.json({ error: 'A product in your cart is no longer available' }, { status: 409 });
      }

      const variant = await db.productVariant.findUnique({
        where: { productId_size: { productId, size } },
        select: { id: true, size: true, stock: true, price: true },
      });
      if (!variant) {
        return NextResponse.json({ error: `Selected size for "${product.title}" is no longer available` }, { status: 409 });
      }
      if (variant.stock < quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for "${product.title}" (${variant.size}). Available: ${variant.stock}` },
          { status: 409 },
        );
      }

      const unitPriceCents = Math.round(Number(variant.price ?? product.price) * 100);
      if (!Number.isSafeInteger(unitPriceCents) || unitPriceCents < 0) {
        throw new Error(`Invalid stored price for product ${product.id}`);
      }
      validatedItems.push({
        product: { id: product.id, title: product.title, slug: product.slug, images: product.images },
        variant: { id: variant.id, size: variant.size, stock: variant.stock },
        quantity,
        unitPriceCents,
        lineTotalCents: unitPriceCents * quantity,
      });
    }

    const totals = calculateCheckoutTotals(
      validatedItems.map((item) => ({
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
      })),
    );
    if (!totals) {
      return NextResponse.json({ error: 'Cart total is too large' }, { status: 400 });
    }
    const { subtotalCents, shippingCents, taxCents, totalCents } = totals;
    const asAmount = (cents: number) => cents / 100;
    const billingAddress = body.billingAddress === undefined
      ? shippingAddress
      : normalizeCheckoutAddress(body.billingAddress, phone);
    if (!billingAddress) {
      return NextResponse.json({ error: 'Enter a valid billing address or leave billing address blank' }, { status: 400 });
    }
    const orderNumber = `VEXO-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    const isGuest = !userId;
    const inventoryReservedAt = paymentMethod === 'cod' ? new Date() : null;

    const order = await db.$transaction(async (tx) => {
      if (paymentMethod === 'cod') {
        for (const item of validatedItems) {
          const updated = await tx.productVariant.updateMany({
            where: { id: item.variant.id, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (updated.count !== 1) {
            throw new CheckoutConflict(`Insufficient stock for "${item.product.title}" (${item.variant.size})`);
          }
          const hasStock = await tx.productVariant.count({
            where: { productId: item.product.id, stock: { gt: 0 } },
          });
          await tx.product.update({
            where: { id: item.product.id },
            data: { inStock: hasStock > 0 },
          });
        }
      }

      return tx.order.create({
        data: {
          orderNumber,
          idempotencyKey,
          guestAccessTokenHash: isGuest ? checkoutTokenHash : null,
          userId,
          guestEmail: isGuest ? email : null,
          guestName: isGuest ? `${firstName} ${lastName}` : null,
          guestPhone: isGuest ? phone : null,
          status: paymentMethod === 'cod' ? OrderStatus.CONFIRMED : OrderStatus.PENDING,
          paymentStatus: 'pending',
          inventoryReservedAt,
          subtotal: asAmount(subtotalCents),
          discount: 0,
          shipping: asAmount(shippingCents),
          tax: asAmount(taxCents),
          total: asAmount(totalCents),
          currency: 'USD',
          shippingAddress,
          billingAddress,
          items: {
            create: validatedItems.map((item) => {
              const primaryImage = Array.isArray(item.product.images) &&
                typeof item.product.images[0] === 'string'
                ? item.product.images[0]
                : null;
              return {
                productId: item.product.id,
                productTitle: item.product.title,
                productSlug: item.product.slug,
                productImage: primaryImage,
                variantId: item.variant.id,
                size: item.variant.size,
                quantity: item.quantity,
                price: asAmount(item.unitPriceCents),
                lineTotal: asAmount(item.lineTotalCents),
              };
            }),
          },
          payment: {
            create: {
              provider: paymentMethod,
              amount: asAmount(totalCents),
              currency: 'USD',
              status: 'pending',
              method: paymentMethod === 'razorpay' ? 'Razorpay' : 'Cash on Delivery',
            },
          },
          ...(paymentMethod === 'cod'
            ? {
                trackingEvents: {
                  create: {
                    status: OrderStatus.CONFIRMED,
                    title: 'Order confirmed',
                    source: 'SYSTEM' as const,
                  },
                },
              }
            : {}),
          addresses: {
            create: [
              { userId, kind: 'shipping', ...shippingAddress },
              { userId, kind: 'billing', ...billingAddress },
            ],
          },
        },
        include: { payment: true },
      });
    });

    return NextResponse.json(responseForOrder(order), { status: 201 });
  } catch (error) {
    if (error instanceof CheckoutConflict) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (isRecord(error) && error.code === 'P2002') {
      return NextResponse.json({ error: 'This checkout was already submitted. Refresh your order status before trying again.' }, { status: 409 });
    }
    console.error('[POST /api/checkout]', error);
    return NextResponse.json({ error: 'Failed to create order. Please try again.' }, { status: 500 });
  }
}
