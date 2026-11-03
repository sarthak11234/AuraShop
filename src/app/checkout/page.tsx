"use client";

import { useState } from 'react';
import { useCartStore } from '@/store/cartStore';
import { cartTotalCents } from '@/store/cartStore';

export default function CheckoutPage() {
  const [step, setStep] = useState<'customer' | 'shipping' | 'billing' | 'payment' | 'confirmation'>('customer');
  const { items } = useCartStore();
  const totalCents = cartTotalCents(items);
  const totalDollars = totalCents / 100;

  // Step navigation
  const handleSetStep = (nextStep: typeof step) => setStep(nextStep);
  const goBack = () => {
    const steps = ['customer', 'shipping', 'billing', 'payment', 'confirmation'] as const;
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) setStep(steps[currentIndex - 1]);
  };

  // Validate email
  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Validate name
  const isValidName = (name: string) =>
    name.trim().length >= 2 && name.trim().length <= 64;

  // Calculate totals
  const subtotal = items.reduce(
    (acc, item) => acc + (item.price ?? 0) * (item.quantity ?? 1),
    0
  );
  const tax = Math.round(subtotal * 0.08 * 100) / 100;
  const shipping = 15.0;
  const total = Math.round((subtotal + tax + shipping) * 100) / 100;

  const createOrder = async () => {
    // In a real implementation, this would call the API
    setStep('confirmation');
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-ink-primary mb-4">Cart is Empty</h2>
          <p className="text-ink-secondary mb-6">
            Add some products to your cart and come back to checkout.
          </p>
          <button
            onClick={() => setStep('customer')}
            className="inline-block px-6 py-3 bg-brand text-primary-foreground rounded-md hover:bg-brand/90"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  // Step components would go here - for now, just show a simplified version
  return (
    <div className="min-h-screen bg-canvas text-ink-primary">
      <header className="border-b border-line bg-surface/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="font-display text-xl font-bold tracking-[0.2em] text-ink-primary">
            VEXO Checkout
          </h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-6">
        <section className="p-8 text-center">
          <h2 className="font-display text-2xl font-bold text-ink-primary mb-4">
            Checkout
          </h2>
          <p className="text-ink-secondary mb-6">
            Please complete your order details.
          </p>
          <div className="bg-surface rounded-xl p-6 max-w-md mx-auto">
            <h3 className="font-medium text-ink-secondary mb-3">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Items</span>
                <span className="ml-auto">{items.length} items</span>
              </div>
              <div>
                <span className="font-medium">Subtotal</span>
                <span className="ml-auto">${subtotal.toFixed(2)}</span>
              </div>
              <div>
                <span className="font-medium">Shipping</span>
                <span className="ml-auto">$15.00</span>
              </div>
              <div>
                <span className="font-medium">Tax</span>
                <span className="ml-auto">${tax.toFixed(2)}</span>
              </div>
              <div className="border-t border-line pt-3">
                <span className="font-medium">Total</span>
                <span className="font-bold ml-auto">${total.toFixed(2)}</span>
              </div>
            </div>
            <button
              onClick={() => setStep('confirmation')}
              className="w-full py-3 px-4 rounded-md font-medium text-ink-primary bg-brand hover:bg-brand/90 transition-colors">
                Place Order
              </button>
            </div>
          </section>
      </main>
    </div>
  );
}