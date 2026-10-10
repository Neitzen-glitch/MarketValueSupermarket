'use client';
import Link from 'next/link';
import { useCart } from './CartProvider';

export default function CartLink() {
  const { count } = useCart();
  return (
    <Link href="/cart" className="flex items-center gap-2 hover:text-peach">
      Cart
      {count > 0 && <span className="rounded-full bg-peach px-2 py-0.5 text-xs font-bold text-brown-dark">{count}</span>}
    </Link>
  );
}
