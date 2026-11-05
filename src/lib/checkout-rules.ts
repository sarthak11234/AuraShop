export type CheckoutAddress = {
  firstName: string;
  lastName: string;
  company: string | null;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function isValidCheckoutName(value: string): boolean {
  return value.length >= 2 && value.length <= 64;
}

export function isValidCheckoutEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidCheckoutPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return value.length <= 24 && digits.length >= 10 && digits.length <= 20;
}

export function normalizeCheckoutAddress(value: unknown, phone: string): CheckoutAddress | null {
  if (!isRecord(value)) return null;

  const addressLine1 = readString(value.addressLine1);
  const city = readString(value.city);
  const postalCode = readString(value.postalCode);
  const firstName = readString(value.firstName);
  const lastName = readString(value.lastName);
  const country = readString(value.country) || 'USA';
  if (
    !isValidCheckoutName(firstName) ||
    !isValidCheckoutName(lastName) ||
    addressLine1.length < 5 ||
    addressLine1.length > 200 ||
    !city ||
    city.length > 100 ||
    !postalCode ||
    postalCode.length > 20 ||
    country.length > 56
  ) {
    return null;
  }

  const company = readString(value.company);
  const addressLine2 = readString(value.addressLine2);
  const state = readString(value.state);
  if (company.length > 100 || addressLine2.length > 200 || state.length > 100) {
    return null;
  }

  return {
    firstName,
    lastName,
    company: company || null,
    phone,
    addressLine1,
    addressLine2: addressLine2 || null,
    city,
    state: state || null,
    postalCode,
    country,
  };
}

export function calculateCheckoutTotals(
  items: Array<{ unitPriceCents: number; quantity: number }>,
): { subtotalCents: number; shippingCents: number; taxCents: number; totalCents: number } | null {
  if (
    items.length === 0 ||
    items.some(({ unitPriceCents, quantity }) =>
      !Number.isSafeInteger(unitPriceCents) ||
      unitPriceCents < 0 ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > 100
    )
  ) {
    return null;
  }

  const subtotalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
  if (!Number.isSafeInteger(subtotalCents)) return null;
  const shippingCents = subtotalCents >= 15_000 ? 0 : 1_500;
  const taxCents = Math.round(subtotalCents * 0.08);
  return {
    subtotalCents,
    shippingCents,
    taxCents,
    totalCents: subtotalCents + shippingCents + taxCents,
  };
}
