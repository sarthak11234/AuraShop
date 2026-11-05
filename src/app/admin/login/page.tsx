import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getAdminActor } from '@/lib/admin';

export default async function AdminLoginPage() {
  const admin = await getAdminActor();
  if (admin) redirect('/admin');
  const session = await auth();

  return (
    <section className="mx-auto flex min-h-[65vh] max-w-xl items-center px-5 py-16">
      <section className="w-full border border-line bg-surface p-6 sm:p-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand">VEXO / ADMIN</p>
        <h1 className="mt-4 text-3xl font-semibold">Administrator access</h1>
        {session?.user ? (
          <p className="mt-4 text-sm leading-6 text-ink-secondary">
            This signed-in account does not have administrator access. Ask an existing system operator to provision
            an approved account; administrator registration is not available here.
          </p>
        ) : (
          <p className="mt-4 text-sm leading-6 text-ink-secondary">
            Sign in using the existing VEXO account provider. Access is granted only to accounts already provisioned
            with an administrative role. There is no public administrator registration.
          </p>
        )}
        <Link href="/" className="mt-7 inline-flex min-h-11 items-center bg-brand px-5 text-sm font-medium text-canvas">
          Return to VEXO sign in
        </Link>
      </section>
    </section>
  );
}
