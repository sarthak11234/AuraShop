import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─────────────── Input validation schemas ───────────────

function isValidSize(size: string): boolean {
  return /^[A-Za-z0-9\s]+$/.test(size) && size.length <= 32;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidName(name: string): boolean {
  return name.trim().length >= 2 && name.trim().length <= 64;
}

// ─────────────── Calculate order totals ───────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
function calculateTotals(cartItems: any[]): {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
} {
  let subtotal = 0;

  for (const item of cartItems) {
    const price = typeof item.price === 'number' ? item.price : 0;
    const quantity = typeof item.quantity === 'number' ? item.quantity : 1;
    subtotal += price * quantity;
  }

  const discount = 0; // Could be calculated based on customer role, cart rules, etc.
  // Simple shipping: flat rate for now
  const shipping = 15.00; // $15 flat shipping
  // Tax: 8% of subtotal
  const tax = Math.round(subtotal * 0.08 * 100) / 100;
  const total = Math.round((subtotal - discount + tax + shipping) * 100) / 100;

  return { subtotal, discount, shipping, tax, total };
}

// ─────────────── POST /api/checkout ───────────────
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      items,
      customerInfo,
      shippingAddress,
      billingAddress,
      paymentMethod,
    } = body;

    // ─────────────── Validate inputs ───────────────

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Cart is empty' },
        { status: 400 }
      );
    }

    // Validate customer type
    const isGuest = !customerInfo || !customerInfo.email;

    if (isGuest) {
      if (!isValidEmail(customerInfo.email)) {
        return NextResponse.json(
          { error: 'Invalid email address' },
          { status: 400 }
        );
      }
      if (!isValidName(customerInfo.firstName)) {
        return NextResponse.json(
          { error: 'Invalid first name' },
          { status: 400 }
        );
      }
      if (!isValidName(customerInfo.lastName)) {
        return NextResponse.json(
          { error: 'Invalid last name' },
          { status: 400 }
        );
      }
      if (!customerInfo.phone || customerInfo.phone.length < 10) {
        return NextResponse.json(
          { error: 'Valid phone number required' },
          { status: 400 }
        );
      }
    } else {
      if (!isValidEmail(customerInfo.email)) {
        return NextResponse.json(
          { error: 'Invalid email address' },
          { status: 400 }
        );
      }
      if (!isValidName(customerInfo.firstName)) {
        return NextResponse.json(
          { error: 'Invalid first name' },
          { status: 400 }
        );
      }
      if (!isValidName(customerInfo.lastName)) {
        return NextResponse.json(
          { error: 'Invalid last name' },
          { status: 400 }
        );
      }
      if (!customerInfo.phone || customerInfo.phone.length < 10) {
        return NextResponse.json(
          { error: 'Valid phone number required' },
          { status: 400 }
        );
      }
    }

    // Validate shipping address
    if (!shippingAddress || !shippingAddress.firstName || !shippingAddress.lastName) {
      return NextResponse.json(
        { error: 'Shipping address required' },
        { status: 400 }
      );
    }
    if (!shippingAddress.city || !shippingAddress.state) {
      return NextResponse.json(
        { error: 'City and state required' },
        { status: 400 }
      );
    }

    // ─────────────── Calculate totals ───────────────
    const { subtotal, discount, shipping, tax, total } = calculateTotals(items);

    // ─────────────── Create order transactionally ───────────────
    const order = await prisma.$transaction(async (tx) => {
      // ─────────────── Create Order ───────────────
      const newOrder = await tx.order.create({
        data: {
          userId: isGuest ? null : customerInfo.userId,
          subtotal: Number(subtotal),
          discount: Number(discount),
          shipping: Number(shipping),
          tax: Number(tax),
          total: Number(total),
          status: isGuest ? 'PENDING' : 'PENDING',
        },
        // ─────────────── Create OrderItems ───────────────
        include: {
          items: {
            data: items.map((item) => ({
              productId: item.productId,
              productTitle: item.name,
              productSlug: item.slug,
              productImage: item.image ?? undefined,
              variantId: item.variantId ?? undefined,
              size: item.size ?? undefined,
              quantity: item.quantity ?? 1,
              price: typeof item.price === 'number' ? item.price : item.price?.priceRaw ?? 0,
              lineTotal: (typeof item.price === 'number' ? item.price : item.price?.priceRaw ?? 0) * (item.quantity ?? 1),
            })),
          },
        },
      });

      // ─────────────── Create Payment record ───────────────
      const paymentProvider = paymentMethod || 'cod';
      let paymentStatus = 'pending';
      let paymentMethodLabel = 'Cash on Delivery';

      if (paymentProvider === 'razorpay') {
        paymentStatus = 'pending';
        paymentMethodLabel = 'Razorpay';
      } else if (paymentProvider === 'cod') {
        paymentStatus = 'pending';
        paymentMethodLabel = 'Cash on Delivery';
      }

      await tx.payment.create({
        data: {
          orderId: newOrder.id,
          provider: paymentProvider,
          amount: total,
          currency: 'USD',
          status: paymentStatus,
          method: paymentProvider,
        },
      });

      // ─────────────── Create Address records ───────────────
      // Shipping address
      await tx.address.create({
        data: {
          userId: isGuest ? null : customerInfo.userId,
          kind: 'shipping',
          firstName: shippingAddress.firstName,
          lastName: shippingAddress.lastName,
          company: shippingAddress.company ?? undefined,
          phone: customerInfo.phone,
          addressLine1: shippingAddress.addressLine1,
          addressLine2: shippingAddress.addressLine2 ?? undefined,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postalCode: shippingAddress.postalCode,
          country: shippingAddress.country ?? 'USA',
        },
      });

      // Billing address (same as shipping by default, or separate)
      await tx.address.create({
        data: {
          userId: isGuest ? null : customerInfo.userId,
          kind: 'billing',
          firstName: billingAddress?.firstName ?? shippingAddress.firstName,
          lastName: billingAddress?.lastName ?? shippingAddress.lastName,
          company: billingAddress?.company ?? shippingAddress.company ?? undefined,
          phone: customerInfo.phone,
          addressLine1: billingAddress?.addressLine1 ?? shippingAddress.addressLine1,
          addressLine2: billingAddress?.addressLine2 ?? shippingAddress.addressLine2 ?? undefined,
          city: billingAddress?.city ?? shippingAddress.city,
          state: billingAddress?.state ?? shippingAddress.state,
          postalCode: billingAddress?.postalCode ?? shippingAddress.postalCode,
          country: billingAddress?.country ?? shippingAddress.country ?? 'USA',
        },
      });

      return newOrder;
    });

    // ─────────────── Return order creation response ───────────────
    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: `#${order.id.slice(-6).toUpperCase()}`,
      subtotal,
      discount,
      shipping,
      tax,
      total,
      paymentMethod: paymentMethod || 'cod',
      status: order.status,
    });
  } catch (error) {
    console.error('[POST /api/checkout]', error);
    return NextResponse.json(
      { error: 'Failed to create order. Please try again.' },
      { status: 500 }
    );
  }
}