import { db } from '@/lib/db';
import { AdminPageHeading, EmptyState, formatDate } from '../_components';
import Link from 'next/link';
import { requireAdminPage } from '@/lib/admin';

type SearchParams = Promise<{ page?: string }>;

export default async function AdminActivityPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdminPage();
  const params = await searchParams;
  const rawPage = Number.parseInt(params.page ?? '1', 10);
  const page = Number.isInteger(rawPage) ? Math.min(100_000, Math.max(1, rawPage)) : 1;
  const [entries, total] = await Promise.all([
    db.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 50,
      take: 50,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        reason: true,
        before: true,
        after: true,
        createdAt: true,
        actor: { select: { name: true, email: true } },
      },
    }),
    db.adminAuditLog.count(),
  ]);
  const totalPages = Math.ceil(total / 50);

  return (
    <>
      <AdminPageHeading
        eyebrow="Governance"
        title="Activity log"
        description="Immutable from this interface. Entries capture privileged mutations and their safe before/after state."
      />
      {entries.length === 0 ? (
        <EmptyState>No administrative activity has been recorded.</EmptyState>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <article key={entry.id} className="border border-line bg-surface p-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="font-medium">{entry.action.replaceAll('.', ' ')}</p>
                  <p className="mt-1 text-xs text-ink-secondary">
                    {entry.entityType} · <span className="font-mono">{entry.entityId}</span>
                  </p>
                </div>
                <div className="text-right text-xs text-ink-muted">
                  <p>{entry.actor.name || entry.actor.email}</p>
                  <p className="mt-1">{formatDate(entry.createdAt)}</p>
                </div>
              </div>
              {entry.reason && <p className="mt-3 text-sm text-ink-secondary">Reason: {entry.reason}</p>}
              {(entry.before || entry.after) && (
                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer text-ink-muted">Change details</summary>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <pre className="overflow-auto border border-line p-2 text-ink-secondary">Before: {JSON.stringify(entry.before)}</pre>
                    <pre className="overflow-auto border border-line p-2 text-ink-secondary">After: {JSON.stringify(entry.after)}</pre>
                  </div>
                </details>
              )}
            </article>
          ))}
          <div className="flex justify-between text-sm text-ink-secondary">
            <span>{total} events · page {page}{totalPages ? ` of ${totalPages}` : ''}</span>
            <div className="flex gap-2">
              {page > 1 && <Link className="border border-line px-3 py-2" href={`/admin/activity?page=${page - 1}`}>Previous</Link>}
              {page < totalPages && <Link className="border border-line px-3 py-2" href={`/admin/activity?page=${page + 1}`}>Next</Link>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
