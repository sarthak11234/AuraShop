import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing order ID' },
        { status: 400 }
      );
    }

    // For COD orders, the order is already created and payment status
    // is set to PENDING. No external gateway call is needed.

    return NextResponse.json({
      status: 'cod_confirmed',
      message: 'Cash on Delivery order confirmed',
    });
  } catch (error) {
    console.error('[POST /api/payment/cod]', error);
    return NextResponse.json(
      { error: 'Failed to process COD order' },
      { status: 500 }
    );
  }
}