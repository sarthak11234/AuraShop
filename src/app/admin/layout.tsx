import type { ReactNode } from 'react';

// Auth-gated admin routes resolve session and database state per request.
export const instant = false;

export default function AdminRouteLayout({ children }: { children: ReactNode }) {
  return children;
}
