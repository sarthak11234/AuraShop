import {
  isValidCheckoutName,
  isValidCheckoutPhone,
  normalizeCheckoutAddress,
  type CheckoutAddress,
} from './checkout-rules';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Collapse accidental whitespace while preserving the display name. */
export function normalizeAccountName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Canonicalise a phone number to a leading optional "+" followed by digits.
 * Returns null when the value cannot be a valid international phone number.
 */
export function normalizeAccountPhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 24 || !/^[+0-9()\-.\s]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 20) return null;
  return `${trimmed.startsWith('+') ? '+' : ''}${digits}`;
}

export type ProfileUpdateInput = {
  name: string;
  phone: string | null;
};

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const FORBIDDEN_PROFILE_FIELDS = [
  'id',
  'email',
  'emailVerified',
  'role',
  'permissions',
  'password',
  'passwordHash',
  'image',
  'createdAt',
  'updatedAt',
] as const;

/**
 * Only the customer-editable profile fields are read from the request.
 * Identity, verification, role and permission fields are rejected outright so
 * a profile update can never impersonate another account or bypass the
 * provider's email verification.
 */
export function validateProfileInput(value: unknown): ValidationResult<ProfileUpdateInput> {
  if (!isRecord(value)) return { ok: false, error: 'Invalid request body' };

  const forbidden = FORBIDDEN_PROFILE_FIELDS.find((field) =>
    Object.prototype.hasOwnProperty.call(value, field),
  );
  if (forbidden) {
    return {
      ok: false,
      error: `${forbidden} cannot be changed here. Email changes must be completed through the sign-in provider.`,
    };
  }

  const name = normalizeAccountName(readString(value.name));
  if (!isValidCheckoutName(name)) {
    return { ok: false, error: 'Name must be between 2 and 64 characters' };
  }

  const rawPhone = readString(value.phone);
  let phone: string | null = null;
  if (rawPhone) {
    phone = normalizeAccountPhone(rawPhone);
    if (phone === null || !isValidCheckoutPhone(phone)) {
      return {
        ok: false,
        error: 'Phone number must contain between 10 and 20 digits and may include +, spaces, dashes or brackets',
      };
    }
  }

  return { ok: true, data: { name, phone } };
}

export const ADDRESS_KINDS = ['shipping', 'billing'] as const;
export type AddressKind = (typeof ADDRESS_KINDS)[number];

/** Guardrail against unbounded saved-address growth per customer. */
export const MAX_SAVED_ADDRESSES = 20;

export type SavedAddressInput = CheckoutAddress & {
  kind: AddressKind;
  landmark: string | null;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
};

function readBooleanFlag(
  value: Record<string, unknown>,
  key: 'isDefaultShipping' | 'isDefaultBilling',
): boolean | null {
  if (value[key] === undefined) return false;
  return typeof value[key] === 'boolean' ? value[key] : null;
}

/**
 * Validates a full saved-address payload. `normalizeCheckoutAddress` is shared
 * with checkout so account addresses cannot drift from the fields the order
 * flow already understands. Landmark and default flags are account-only.
 */
export function validateSavedAddressInput(value: unknown): ValidationResult<SavedAddressInput> {
  if (!isRecord(value)) return { ok: false, error: 'Invalid request body' };

  const phone = readString(value.phone);
  if (!isValidCheckoutPhone(phone)) {
    return { ok: false, error: 'A valid phone number with 10-20 digits is required' };
  }
  const normalizedPhone = normalizeAccountPhone(phone);
  if (!normalizedPhone) {
    return { ok: false, error: 'A valid phone number is required' };
  }

  const base = normalizeCheckoutAddress(value, normalizedPhone);
  if (!base) {
    return {
      ok: false,
      error: 'Enter a valid name, street address, city, postal code and country',
    };
  }

  const landmark = readString(value.landmark);
  if (landmark.length > 120) {
    return { ok: false, error: 'Landmark must be 120 characters or fewer' };
  }

  const rawKind = readString(value.kind) || 'shipping';
  if (!ADDRESS_KINDS.includes(rawKind as AddressKind)) {
    return { ok: false, error: 'Address type must be shipping or billing' };
  }

  const isDefaultShipping = readBooleanFlag(value, 'isDefaultShipping');
  const isDefaultBilling = readBooleanFlag(value, 'isDefaultBilling');
  if (isDefaultShipping === null || isDefaultBilling === null) {
    return { ok: false, error: 'Default address flags must be true or false' };
  }

  return {
    ok: true,
    data: {
      ...base,
      kind: rawKind as AddressKind,
      landmark: landmark || null,
      isDefaultShipping,
      isDefaultBilling,
    },
  };
}

/** Saved addresses are only rows without an order snapshot link. */
export function isOwnedSavedAddress(
  address: { userId: string | null; orderId: string | null },
  userId: string,
): boolean {
  return address.userId === userId && address.orderId === null;
}

export function isValidAddressId(value: string): boolean {
  return /^[1-9]\d{0,9}$/.test(value);
}
