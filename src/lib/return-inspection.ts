import type { ItemCondition, Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { writeAdminAudit } from '@/lib/admin';
import { rateLimitActorAction } from '@/lib/rate-limit';
import {
  returnStatusLabel,
  type ReturnStatus,
} from '@/lib/return-lifecycle';

export type InspectionItemInput = {
  returnItemId: string;
  receivedQuantity: number;
  inspectedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  condition: ItemCondition;
  restockable: boolean;
  inspectionNotes?: string | null;
};

/** Result of recording an inspection. */
export type InspectResult =
  | { kind: 'inspected'; restoredCents: number; restockableQuantity: number }
  | { kind: 'not-found' }
  | { kind: 'not-eligible'; reason: string }
  | { kind: 'conflict' }
  | { kind: 'duplicate'; reason: string };

/**
 * Records inspection results for a return. Inventory is restored only for the
 * accepted quantity explicitly marked restockable. Duplicate inspection
 * submissions are blocked to prevent double stock restoration.
 */
export async function inspectReturnItems({
  actorId,
  returnRequestId,
  items,
}: {
  actorId: string;
  returnRequestId: string;
  items: InspectionItemInput[];
}): Promise<InspectResult> {
  return db.$transaction(async (tx) => {
    const rateLimit = await rateLimitActorAction(
      actorId,
      'return-inspect',
      10,
      60_000,
    );
    if (rateLimit) {
      throw new Error('Too many inspection requests; try again shortly.');
    }

    const returnRequest = await tx.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: { items: true, inspections: true },
    });
    if (!returnRequest) return { kind: 'not-found' };

    if (
      returnRequest.status !== 'RETURN_RECEIVED' &&
      returnRequest.status !== 'INSPECTION_PENDING'
    ) {
      return {
        kind: 'not-eligible',
        reason: `Inspection requires a received return (current: ${returnStatusLabel(returnRequest.status)}).`,
      };
    }

    // Duplicate prevention: an inspection already recorded for this return.
    if (returnRequest.inspections.length > 0) {
      return {
        kind: 'duplicate',
        reason: 'An inspection has already been recorded for this return. Stock has already been restored.',
      };
    }

    // Validate each inspection item.
    let totalRestockable = 0;
    const inspectionData: Prisma.ReturnInspectionCreateInput[] = [];
    const returnItemMap = new Map(returnRequest.items.map((i) => [i.id, i]));

    for (const input of items) {
      const returnItem = returnItemMap.get(input.returnItemId);
      if (!returnItem) {
        return { kind: 'not-found' };
      }

      if (
        input.receivedQuantity < 0 ||
        input.inspectedQuantity < 0 ||
        input.acceptedQuantity < 0 ||
        input.rejectedQuantity < 0
      ) {
        return {
          kind: 'not-eligible',
          reason: 'Quantities cannot be negative.',
        };
      }

      // Rule 1: accepted + rejected cannot exceed received.
      if (
        input.acceptedQuantity + input.rejectedQuantity >
        input.receivedQuantity
      ) {
        return {
          kind: 'not-eligible',
          reason: `Accepted + rejected (${input.acceptedQuantity + input.rejectedQuantity}) cannot exceed received (${input.receivedQuantity}) for "${returnItem.productTitle}".`,
        };
      }

      // Rule 2: inspected cannot exceed received.
      if (input.inspectedQuantity > input.receivedQuantity) {
        return {
          kind: 'not-eligible',
          reason: `Inspected quantity cannot exceed received quantity for "${returnItem.productTitle}".`,
        };
      }

      // Restock only accepted + restockable.
      if (input.restockable && input.acceptedQuantity > 0) {
        totalRestockable += input.acceptedQuantity;
      }

      inspectionData.push({
        returnRequest: { connect: { id: returnRequestId } },
        returnItem: { connect: { id: input.returnItemId } },
        receivedQuantity: input.receivedQuantity,
        inspectedQuantity: input.inspectedQuantity,
        acceptedQuantity: input.acceptedQuantity,
        rejectedQuantity: input.rejectedQuantity,
        condition: input.condition,
        restockable: input.restockable,
        inspectionNotes: input.inspectionNotes ?? null,
        inspectedAt: new Date(),
        inspector: { connect: { id: actorId } },
      });
    }

    // Transition to INSPECTED.
    const claimed = await tx.returnRequest.updateMany({
      where: {
        id: returnRequestId,
        status: { in: ['RETURN_RECEIVED', 'INSPECTION_PENDING'] },
      },
      data: { status: 'INSPECTED' as ReturnStatus },
    });
    if (claimed.count !== 1) return { kind: 'conflict' };

    for (const data of inspectionData) {
      await tx.returnInspection.create({ data });
    }

    // Restore inventory only for restockable accepted quantities.
    if (totalRestockable > 0) {
      for (const input of items) {
        if (!input.restockable || input.acceptedQuantity < 1) continue;
        const returnItem = returnItemMap.get(input.returnItemId);
        if (!returnItem?.variantId) continue;

        // Restore stock.
        await tx.productVariant.update({
          where: { id: returnItem.variantId },
          data: { stock: { increment: input.acceptedQuantity } },
        });
        await tx.product.update({
          where: { id: returnItem.productId },
          data: { inStock: true },
        });

        // Record the inventory adjustment.
        const variant = await tx.productVariant.findUnique({
          where: { id: returnItem.variantId },
          select: { stock: true },
        });
        await tx.inventoryAdjustment.create({
          data: {
            variantId: returnItem.variantId,
            actorId,
            previousQuantity: variant!.stock - input.acceptedQuantity,
            newQuantity: variant!.stock,
            difference: input.acceptedQuantity,
            reason: `Return restock: ${returnItem.productTitle} (return ${returnNumber(returnRequest)})`,
          },
        });
      }
    }

    await tx.returnStatusEvent.create({
      data: {
        returnRequestId,
        status: 'INSPECTED' as ReturnStatus,
        title: returnStatusLabel('INSPECTED'),
        source: 'ADMIN',
        actorId,
        description: `Inspected ${items.length} item(s); ${totalRestockable} unit(s) restored to sellable stock.`,
      },
    });

    await writeAdminAudit(tx, {
      actorId,
      action: 'return.inspected',
      entityType: 'return',
      entityId: returnRequestId,
      reason: `${totalRestockable} unit(s) restockable`,
    });

    return {
      kind: 'inspected',
      restoredCents: 0,
      restockableQuantity: totalRestockable,
    };
  });
}

function returnNumber(returnRequest: {
  returnNumber: string;
}): string {
  return returnRequest.returnNumber;
}

/**
 * Records that a return shipment has been received by the warehouse.
 * Transitions RETURN_SHIPPED → RETURN_RECEIVED.
 */
export async function receiveReturnShipment({
  actorId,
  returnRequestId,
  receivedQuantity,
}: {
  actorId: string;
  returnRequestId: string;
  receivedQuantity: number;
}): Promise<
  | { kind: 'received' }
  | { kind: 'not-found' }
  | { kind: 'not-eligible'; reason: string }
  | { kind: 'conflict' }
> {
  return db.$transaction(async (tx) => {
    const returnRequest = await tx.returnRequest.findUnique({
      where: { id: returnRequestId },
    });
    if (!returnRequest) return { kind: 'not-found' };

    if (returnRequest.status !== 'RETURN_SHIPPED') {
      return {
        kind: 'not-eligible',
        reason: `Receipt requires a shipped return (current: ${returnStatusLabel(returnRequest.status)}).`,
      };
    }

    const claimed = await tx.returnRequest.updateMany({
      where: { id: returnRequestId, status: 'RETURN_SHIPPED' },
      data: { status: 'RETURN_RECEIVED' as ReturnStatus },
    });
    if (claimed.count !== 1) return { kind: 'conflict' };

    await tx.returnStatusEvent.create({
      data: {
        returnRequestId,
        status: 'RETURN_RECEIVED' as ReturnStatus,
        title: returnStatusLabel('RETURN_RECEIVED'),
        source: 'ADMIN',
        actorId,
        description: `Return shipment received (${receivedQuantity} unit(s)).`,
      },
    });

    await writeAdminAudit(tx, {
      actorId,
      action: 'return.received',
      entityType: 'return',
      entityId: returnRequestId,
      reason: `${receivedQuantity} unit(s) received`,
    });

    return { kind: 'received' };
  });
}
