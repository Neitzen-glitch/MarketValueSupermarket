'use client';
import Link from 'next/link';
import { useCart } from './CartProvider';
import { priceCart } from '@/lib/pricing';
import { naira } from '@/lib/money';

export default function CartView() {
  const { items, ready, setQty, remove } = useCart();
  if (!ready) return <p className="text-sm">Loading your cart…</p>;
  if (!items.length) {
    return (
      <div className="card px-6 py-16 text-center">
        <p className="text-lg font-semibold">Your cart is empty</p>
        <Link href="/" className="btn-peach mt-5">
          Browse products
        </Link>
      </div>
    );
  }
  const totals = priceCart(items);
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <ul className="space-y-4">
        {totals.lines.map((l) => {
          const item = items.find((i) => i.variantId === l.variantId)!;
          return (
            <li key={l.variantId} className="card flex gap-4 p-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-peach-light">
                {item.imageUrl && <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1">
                <Link href={`/products/${item.slug}`} className="font-semibold hover:underline">
                  {l.productName}
                </Link>
                <p className="text-xs text-brown-light">{l.variantName}</p>
                <p className="mt-1 text-sm">
                  {naira(l.unitPrice)} each{l.unitPrice < l.basePrice ? ' · wholesale price' : ''}
                  {l.deliveryFeePerUnit > 0 && <span className="text-brown-light"> · delivery {naira(l.deliveryFeePerUnit)} each</span>}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex items-center overflow-hidden rounded-full border border-brown/20 text-sm">
                    <button className="px-3 py-1 hover:bg-cream-dark" onClick={() => setQty(l.variantId, l.quantity - 1)}>
                      −
                    </button>
                    <span className="w-8 text-center font-semibold">{l.quantity}</span>
                    <button className="px-3 py-1 hover:bg-cream-dark" onClick={() => setQty(l.variantId, l.quantity + 1)}>
                      +
                    </button>
                  </div>
                  <button onClick={() => remove(l.variantId)} className="text-xs text-brown-light underline">
                    Remove
                  </button>
                </div>
              </div>
              <p className="font-semibold">{naira(l.lineTotal)}</p>
            </li>
          );
        })}
      </ul>
      <aside className="card h-fit space-y-3 p-5 text-sm">
        <h2 className="text-base font-semibold">Order summary</h2>
        <div className="flex justify-between">
          <span>Items</span>
          <span>{naira(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Delivery</span>
          <span>{naira(totals.deliveryTotal)}</span>
        </div>
        <div className="flex justify-between border-t border-brown/15 pt-3 text-base font-bold">
          <span>Total</span>
          <span>{naira(totals.total)}</span>
        </div>
        <Link href="/checkout" className="btn-peach w-full">
          Checkout
        </Link>
        <p className="text-xs text-brown-light">Final prices and stock are confirmed at checkout.</p>
      </aside>
    </div>
  );
}
