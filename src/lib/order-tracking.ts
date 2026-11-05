import { Prisma, TrackingEventSource, type OrderStatus } from '@prisma/client';
import { trackingEventTitle } from '@/lib/order-lifecycle';
import type { ValidationResult } from '@/lib/account-validation';

export type TrackingMetadata = {
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  location?: string | null;
  description?: string | null;
  shippedAt?: Date | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasKey(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function optionalText(
  value: unknown,
  { label, max }: { label: string; max: number },
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false, error: `${label} must be text` };
  const trimmed = value.trim();
  if (trimmed.length > max) return { ok: false, error: `${label} must be ${max} characters or fewer` };
  return { ok: true, value: trimmed || null };
}

/** Validates the manual shipment fields accepted from the admin UI. */
export function parseTrackingMetadata(value: unknown): ValidationResult<TrackingMetadata> {
  if (!isRecord(value)) return { ok: false, error: 'Invalid request body' };

  const metadata: TrackingMetadata = {};

  if (hasKey(value, 'carrier')) {
    const carrier = optionalText(value.carrier, { label: 'Carrier', max: 80 });
    if (!carrier.ok) return carrier;
    metadata.carrier = carrier.value;
  }
  if (hasKey(value, 'trackingNumber')) {
    const trackingNumber = optionalText(value.trackingNumber, { label: 'Tracking number', max: 100 });
    if (!trackingNumber.ok) return trackingNumber;
    if (trackingNumber.value && !/^[A-Za-z0-9._\- /]+$/.test(trackingNumber.value)) {
      return { ok: false, error: 'Tracking number contains unsupported characters' };
    }
    metadata.trackingNumber = trackingNumber.value;
  }
  if (hasKey(value, 'trackingUrl')) {
    const trackingUrl = optionalText(value.trackingUrl, { label: 'Tracking URL', max: 500 });
    if (!trackingUrl.ok) return trackingUrl;
    if (trackingUrl.value) {
      try {
        const url = new URL(trackingUrl.value);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          return { ok: false, error: 'Tracking URL must use http or https' };
        }
      } catch {
        return { ok: false, error: 'Tracking URL must be a valid URL' };
      }
    }
    metadata.trackingUrl = trackingUrl.value;
  }
  if (hasKey(value, 'location')) {
    const location = optionalText(value.location, { label: 'Location', max: 120 });
    if (!location.ok) return location;
    metadata.location = location.value;
  }
  if (hasKey(value, 'description')) {
    const description = optionalText(value.description, { label: 'Event description', max: 500 });
    if (!description.ok) return description;
    metadata.description = description.value;
  }
  if (hasKey(value, 'shippedAt')) {
    if (value.shippedAt === null || value.shippedAt === '') {
      metadata.shippedAt = null;
    } else if (typeof value.shippedAt === 'string') {
      const parsed = new Date(value.shippedAt);
      if (Number.isNaN(parsed.getTime())) {
        return { ok: false, error: 'Shipment timestamp is invalid' };
      }
      if (parsed.getTime() > Date.now() + 5 * 60_000) {
        return { ok: false, error: 'Shipment timestamp cannot be in the future' };
      }
      metadata.shippedAt = parsed;
    } else {
      return { ok: false, error: 'Shipment timestamp is invalid' };
    }
  }

  return { ok: true, data: metadata };
}

/**
 * Idempotent tracking event writer. The unique (orderId, status) constraint is
 * the last line of defence against duplicate timeline entries.
 */
export async function upsertOrderTrackingEvent(
  tx: Prisma.TransactionClient,
  {
    orderId,
    status,
    source,
    createdBy,
    title,
    description,
    location,
    carrier,
    trackingNumber,
  }: {
    orderId: string;
    status: OrderStatus;
    source: TrackingEventSource;
    createdBy?: string | null;
    title?: string;
    description?: string | null;
    location?: string | null;
    carrier?: string | null;
    trackingNumber?: string | null;
  },
) {
  const resolvedTitle = title || trackingEventTitle(status);
  return tx.orderTrackingEvent.upsert({
    where: { orderId_status: { orderId, status } },
    update: {
      title: resolvedTitle,
      ...(description !== undefined ? { description } : {}),
      ...(location !== undefined ? { location } : {}),
      ...(carrier !== undefined ? { carrier } : {}),
      ...(trackingNumber !== undefined ? { trackingNumber } : {}),
      source,
      createdBy: createdBy ?? null,
    },
    create: {
      orderId,
      status,
      title: resolvedTitle,
      description: description ?? null,
      location: location ?? null,
      source,
      carrier: carrier ?? null,
      trackingNumber: trackingNumber ?? null,
      createdBy: createdBy ?? null,
    },
  });
}
