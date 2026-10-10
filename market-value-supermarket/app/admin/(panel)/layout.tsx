import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { signOut } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: { default: 'Admin', template: '%s | Admin' }, robots: { index: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-screen">
      <header className="bg-brown text-cream">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="font-bold">
            Market Value <span className="text-xs font-medium uppercase tracking-widest text-peach">Admin</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-5 text-sm font-medium">
            <Link href="/admin/products" className="hover:text-peach">Products</Link>
            <Link href="/admin/orders" className="hover:text-peach">Orders</Link>
            <Link href="/admin/subscribers" className="hover:text-peach">Subscribers</Link>
            <Link href="/" target="_blank" className="hover:text-peach">View shop ↗</Link>
            <form action={signOut}>
              <button className="hover:text-peach">Sign out</button>
            </form>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>
    </div>
  );
}
