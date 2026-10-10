'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from './CartProvider';
import { priceCart } from '@/lib/pricing';
import { naira } from '@/lib/money';

export default function CheckoutForm() {
  const { items, ready, clear } = useCart();
  const router = useRouter();
  const [method, setMethod] = useState<'online' | 'cod'>('online');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!ready) return <p className="text-sm">Loading…</p>;
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

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: f.get('name'),
          email: f.get('email'),
          phone: f.get('phone'),
          address: f.get('address'),
          notes: f.get('notes') || '',
          method,
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Something went wrong. Please try again.');
        setBusy(false);
        return;
      }
      if (method === 'cod') clear();
      if (/^https?:/.test(json.redirect)) window.location.href = json.redirect;
      else router.push(json.redirect);
    } catch {
      setError('Network problem. Please check your connection and try again.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">Your details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Full name</label>
              <input name="name" required autoComplete="name" className="input" />
            </div>
            <div>
              <label className="label">Phone number</label>
              <input name="phone" type="tel" required autoComplete="tel" placeholder="0803 123 4567" className="input" />
            </div>
          </div>
          <div>
            <label className="label">Email (your receipt is sent here)</label>
            <input name="email" type="email" required autoComplete="email" className="input" />
          </div>
          <div>
            <label className="label">Delivery address</label>
            <textarea name="address" required rows={3} autoComplete="street-address" className="input" />
          </div>
          <div>
            <label className="label">Note for the shop (optional)</label>
            <input name="notes" className="input" />
          </div>
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">How would you like to pay?</h2>
          {(
            [
              ['online', 'Pay online now', 'Card, bank transfer or USSD, securely through Paystack.'],
              ['cod', 'Pay on delivery', 'Pay in cash or by transfer when your order arrives.'],
            ] as const
          ).map(([val, title, desc]) => (
            <label key={val} className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${method === val ? 'border-brown bg-peach-light/60' : 'border-brown/15'}`}>
              <input type="radio" name="method" checked={method === val} onChange={() => setMethod(val)} className="mt-1 accent-[#5A3825]" />
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-xs text-brown-light">{desc}</span>
              </span>
            </label>
          ))}
        </section>
      </div>

      <aside className="card h-fit space-y-3 p-5 text-sm">
        <h2 className="text-base font-semibold">Order summary</h2>
        <ul className="space-y-2">
          {totals.lines.map((l) => (
            <li key={l.variantId} className="flex justify-between gap-3">
              <span>
                {l.productName} <span className="text-brown-light">· {l.variantName} × {l.quantity}</span>
              </span>
              <span>{naira(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-brown/15 pt-3">
          <span>Delivery</span>
          <span>{naira(totals.deliveryTotal)}</span>
        </div>
        <div className="flex justify-between text-base font-bold">
          <span>Total</span>
          <span>{naira(totals.total)}</span>
        </div>
        {error && <p className="rounded-lg bg-peach-light p-3 text-xs font-medium">{error}</p>}
        <button disabled={busy} className="btn-peach w-full">
          {busy ? 'Please wait…' : method === 'online' ? 'Pay now' : 'Place order'}
        </button>
        <p className="text-xs text-brown-light">We hold your items for 15 minutes while you pay.</p>
      </aside>
    </form>
  );
}
