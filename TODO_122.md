# Phase 12.2 Implementation Plan

## Audit Findings

### Reusable infrastructure (do NOT duplicate)
- **Payments**: `src/lib/payment.ts` — `createRazorpayRefund`, `createRazorpayOrder`, `captureRazorpayPayment`, signature/webhook verification.
- **Refund model**: `Refund` (amount, status, providerRefundId, gatewayResponse, failureReason, actorId) — reuse, do not rebuild.
- **Inventory**: `restoreReservedInventory` (order-cancellation.ts), `InventoryAdjustment` model, stock decrement on settlement.
- **Authz**: `requireAccountApi`, `requireAdminApi`, `getCustomerOrderDetail` (ownership-scoped), `canAccessOrder`.
- **Audit**: `AdminAuditLog` model + `writeAdminAudit(tx, entry)`.
- **Rate limiting**: `rateLimitActorAction` backed by `AdminRateLimit`.
- **Tracking events**: `upsertOrderTrackingEvent`, unique (orderId,status) idempotency.
- **Validation**: `account-validation.ts` patterns (`ValidationResult`, `isRecord`, `readString`).
- **Order status machine**: `ORDER_STATUS_TRANSITIONS` in admin-order-status.ts (DELIVERED → RETURNED already valid).

### Missing (to build)
- Return/exchange models: ReturnRequest, ReturnItem, ReturnStatusEvent, ReturnShipment, ReturnInspection, ExchangeRequest, OfflineRefund.
- Return policy service (centralized eligibility).
- Return state machine + transition service.
- Customer return create/list/detail APIs + UI.
- Admin return list/detail + approve/reject/receive/inspect/refund/exchange/tracking APIs + UI.
- Inspection → inventory restoration (only restockable accepted qty).
- Razorpay refund integration (via existing `createRazorpayRefund`).
- COD offline refund workflow.
- Exchange workflow (replacement stock reservation).
- Unit + integration + Playwright tests.

### Credentials
- Razorpay: NOT configured in `.env.local` → safe-unavailable path required.
- Resend: configured but no general email utility → integration points only, no false "sent" claims.

## File plan

### Schema/migration
- `prisma/schema.prisma` — add Return*/Exchange*/OfflineRefund models + enums.
- `prisma/migrations/20261106000000_returns_exchanges_refunds/migration.sql` — additive only.

### Services (src/lib/)
- `return-policy.ts` — centralized eligibility + policy config.
- `return-lifecycle.ts` — status transition validation.
- `return-service.ts` — create/cancel/claim ownership.
- `return-refund.ts` — refundable balance + Razorpay/COD refund processing.
- `return-inspection.ts` — inspection + atomic inventory restoration.
- `return-exchange.ts` — exchange + replacement stock reservation.

### Customer APIs (src/app/api/account/returns/)
- `route.ts` GET/POST, `[returnId]/route.ts` GET, `[returnId]/cancel/route.ts` POST.

### Admin APIs (src/app/api/admin/returns/)
- `route.ts` GET, `[returnId]/route.ts` GET, `review/approve/reject/receive/inspect/refund/exchange/tracking` POST.

### UI
- `src/app/account/returns/` (page, new/[orderId], [returnId])
- `src/app/admin/returns/` (page, [returnId])
- `src/components/account/AccountNav.tsx` — add Returns item.
- `src/app/account/orders/[orderId]/page.tsx` — add return button for eligible delivered orders.

### Tests
- `src/lib/return-policy.test.ts`, `return-lifecycle.test.ts`, `return-refund.test.ts`, `return-inspection.test.ts`, `return-exchange.test.ts`.
- `src/app/__tests__/return-journeys.spec.ts` (Journeys A–G).
