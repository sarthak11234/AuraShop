/**
 * Shipping provider boundary.
 *
 * VEXO currently has no courier API integration. Fulfilment is manual: an
 * administrator enters carrier/tracking details and moves the order through
 * valid status transitions. Keeping the provider explicit makes it possible to
 * add a courier adapter later without changing the customer tracking model.
 */
export interface ShippingProvider {
  id: string;
  label: string;
  automaticTracking: boolean;
}

export const MANUAL_SHIPPING_PROVIDER: ShippingProvider = {
  id: 'manual',
  label: 'Manual fulfilment',
  automaticTracking: false,
};

export function getShippingProvider(): ShippingProvider {
  return MANUAL_SHIPPING_PROVIDER;
}
