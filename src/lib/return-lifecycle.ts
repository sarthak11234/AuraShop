import type { ExchangeStatus, ReturnStatus } from '@prisma/client';

export type { ExchangeStatus, ReturnStatus };

/** Every valid return-request status transition. */
export const RETURN_STATUS_TRANSITIONS: Record<
  ReturnStatus,
  readonly ReturnStatus[]
> = {
  REQUESTED: ['UNDER_REVIEW', 'CANCELLED'],
  UNDER_REVIEW: ['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'],
  APPROVED: ['RETURN_SHIPPED', 'CANCELLED'],
  PARTIALLY_APPROVED: ['RETURN_SHIPPED', 'CANCELLED'],
  REJECTED: [], // terminal
  RETURN_SHIPPED: ['RETURN_RECEIVED'],
  RETURN_RECEIVED: ['INSPECTION_PENDING'],
  INSPECTION_PENDING: ['INSPECTED'],
  INSPECTED: ['REFUND_PENDING', 'EXCHANGE_PENDING', 'REJECTED'],
  REFUND_PENDING: ['REFUND_PROCESSING'],
  REFUND_PROCESSING: ['REFUNDED'],
  REFUNDED: ['COMPLETED'],
  EXCHANGE_PENDING: ['EXCHANGE_PROCESSING'],
  EXCHANGE_PROCESSING: ['EXCHANGED'],
  EXCHANGED: ['COMPLETED'],
  COMPLETED: [], // terminal
  CANCELLED: [], // terminal
};

/** Labels for the customer-facing timeline. */
export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  REQUESTED: 'Return requested',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Return approved',
  PARTIALLY_APPROVED: 'Partially approved',
  REJECTED: 'Return rejected',
  RETURN_SHIPPED: 'Return shipped',
  RETURN_RECEIVED: 'Return received',
  INSPECTION_PENDING: 'Inspection pending',
  INSPECTED: 'Inspected',
  REFUND_PENDING: 'Refund pending',
  REFUND_PROCESSING: 'Refund processing',
  REFUNDED: 'Refunded',
  EXCHANGE_PENDING: 'Exchange pending',
  EXCHANGE_PROCESSING: 'Exchange processing',
  EXCHANGED: 'Exchanged',
  COMPLETED: 'Completed',
  CANCELLED: 'Return cancelled',
};

/** Customer-initiated actions that may transition a return. */
export const CUSTOMER_ACTION_STATUSES: readonly ReturnStatus[] = [
  'REQUESTED',
  'CANCELLED',
];

/** Admin-initiated actions that may transition a return. */
export const ADMIN_ACTION_STATUSES: readonly ReturnStatus[] = [
  'UNDER_REVIEW',
  'APPROVED',
  'PARTIALLY_APPROVED',
  'REJECTED',
  'RETURN_RECEIVED',
  'INSPECTED',
  'REFUND_PROCESSING',
  'EXCHANGE_PROCESSING',
];

export function canTransitionReturnStatus(
  current: ReturnStatus,
  next: ReturnStatus,
): boolean {
  return RETURN_STATUS_TRANSITIONS[current].includes(next);
}

export function returnStatusLabel(status: ReturnStatus): string {
  return RETURN_STATUS_LABELS[status] ?? status.replaceAll('_', ' ');
}

/** Whether the given status is a terminal state. */
export function isTerminalReturnStatus(status: ReturnStatus): boolean {
  return RETURN_STATUS_TRANSITIONS[status].length === 0;
}

/** Whether a customer may directly trigger this transition. */
export function isCustomerInitiatedTransition(next: ReturnStatus): boolean {
  return CUSTOMER_ACTION_STATUSES.includes(next);
}

/** Whether an admin may directly trigger this transition. */
export function isAdminInitiatedTransition(next: ReturnStatus): boolean {
  return ADMIN_ACTION_STATUSES.includes(next);
}
