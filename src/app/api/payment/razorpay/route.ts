import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { amount, orderId } = await request.json();

    if (!amount || !orderId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // In a real implementation, you would generate the Razorpay order using
    // your Razorpay Key ID and Key Secret from environment variables.
    // For now, we simulate the response.

    const mockRazorpayOrder = {
      id: orderId,
      amount: amount * 100, // Razorpay uses paise (cents)
      currency: 'USD',
    };

    const mockSignature = 'test_signature_' + orderId;

    return NextResponse.json({
      status: 'created',
      razorpay_order_id: mockRazorpayOrder.id,
      razorpay_amount: mockRazorpayOrder.amount,
      razorpay_currency: mockRazorpayOrder.currency,
      razorpay_signature: mockSignature,
    });
  } catch (error) {
    console.error('[POST /api/payment/razorpay/create]', error);
    return NextResponse.json(
      { error: 'Failed to create Razorpay order' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  // For debugging - list recent payments
  try {
    // In production, this would require proper authentication
    return NextResponse.json({ message: 'Payment API endpoint' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch payment data' },
      { status: 500 }
    );
  }
}