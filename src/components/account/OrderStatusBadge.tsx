import type { OrderStatus } from '@prisma/client';
import { orderStatusLabel } from '@/lib/order-lifecycle';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  CONFIRMED: 'border-cyan/40 bg-cyan/10 text-cyan',
  PROCESSING: 'border-cyan/40 bg-cyan/10 text-cyan',
  PACKED: 'border-cyan/40 bg-cyan/10 text-cyan',
  SHIPPED: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
  OUT_FOR_DELIVERY: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
  DELIVERED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  FAILED_DELIVERY: 'border-orange-500/40 bg-orange-500/10 text-orange-200',
  CANCELLED: 'border-brand/40 bg-brand/10 text-brand',
  RETURNED: 'border-brand/40 bg-brand/10 text-brand',
};

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center border px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em]',
        STATUS_STYLES[status],
        className,
      )}
    >
      {orderStatusLabel(status)}
    </span>
  );
}
