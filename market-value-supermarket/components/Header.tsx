import Link from 'next/link';
import CartLink from './CartLink';

export default function Header() {
  return (
    <header className="sticky top-0 z-30 bg-brown text-cream shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="leading-tight">
          <span className="block text-lg font-bold">Market Value</span>
          <span className="block text-[11px] font-medium uppercase tracking-[0.2em] text-peach">Supermarket</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium">
          <Link href="/" className="hover:text-peach">
            Shop
          </Link>
          <CartLink />
        </nav>
      </div>
    </header>
  );
}
