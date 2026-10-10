'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useCart } from './CartProvider';
import { unitPriceFor, type Tier } from '@/lib/pricing';
import { naira } from '@/lib/money';

type V = { id: string; name: string; price: number; available: number; tiers: Tier[]; isShare: boolean };
type Props = {
  productId: string;
  slug: string;
  productName: string;
  imageUrl: string | null;
  deliveryFee: number;
  variants: V[];
  basket: { totalShares: number; sharesLeft: number; open: boolean } | null;
};

export default function AddToCart(p: Props) {
  const { add } = useCart();
  const [vid, setVid] = useState((p.variants.find((v) => v.available > 0) ?? p.variants[0])?.id);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const v = p.variants.find((x) => x.id === vid);
  if (!v) return <p className="text-sm text-brown-light">Nothing to buy yet.</p>;

  const closed = v.isShare && p.basket && !p.basket.open;
  const canBuy = v.available > 0 && !closed;
  const unit = unitPriceFor(v.price, v.tiers, qty);
  const tiers = [...v.tiers].sort((a, b) => a.minQty - b.minQty);

  function addToCart() {
    if (!v) return;
    add({
      variantId: v.id,
      productId: p.productId,
      productName: p.productName,
      variantName: v.name,
      quantity: qty,
      basePrice: v.price,
      tiers: v.tiers,
      deliveryFeePerUnit: p.deliveryFee,
      slug: p.slug,
      imageUrl: p.imageUrl,
      maxQty: v.available,
    });
    setAdded(true);
  }

  return (
    <div className="space-y-5">
      {p.basket && (
        <div>
          <div className="flex justify-between text-xs font-medium">
            <span>{p.basket.open ? 'Basket shares' : 'Basket closed'}</span>
            <span>
              {p.basket.totalShares - p.basket.sharesLeft} of {p.basket.totalShares} shares taken
            </span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-cream-dark">
            <div className="h-full rounded-full bg-peach" style={{ width: `${Math.min(100, ((p.basket.totalShares - p.basket.sharesLeft) / p.basket.totalShares) * 100)}%` }} />
          </div>
        </div>
      )}

      <div>
        <span className="label">Choose an option</span>
        <div className="flex flex-wrap gap-2">
          {p.variants.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => {
                setVid(x.id);
                setQty(1);
                setAdded(false);
              }}
              disabled={x.available === 0}
              className={`rounded-xl border px-4 py-2 text-left text-sm transition disabled:opacity-40 ${
                x.id === vid ? 'border-brown bg-brown text-cream' : 'border-brown/20 hover:bg-cream-dark'
              }`}
            >
              <span className="block font-medium">{x.name}</span>
              <span className="block text-xs opacity-80">{x.available === 0 ? 'Sold out' : naira(x.price)}</span>
            </button>
          ))}
        </div>
      </div>

      {tiers.length > 0 && (
        <div className="rounded-xl bg-peach-light p-4 text-sm">
          <p className="font-semibold">Wholesale prices</p>
          <ul className="mt-1 space-y-0.5">
            {tiers.map((t) => (
              <li key={t.minQty}>
                Buy {t.minQty}+ → <b>{naira(t.price)}</b> each
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-end gap-4">
        <div>
          <span className="label">Quantity</span>
          <div className="flex items-center overflow-hidden rounded-full border border-brown/20">
            <button type="button" className="px-4 py-2 hover:bg-cream-dark" onClick={() => setQty((q) => Math.max(1, q - 1))}>
              −
            </button>
            <span className="w-10 text-center text-sm font-semibold">{qty}</span>
            <button type="button" className="px-4 py-2 hover:bg-cream-dark" onClick={() => setQty((q) => Math.min(v.available || 1, q + 1))}>
              +
            </button>
          </div>
        </div>
        <div className="pb-1">
          <p className="text-2xl font-bold">{naira(unit * qty)}</p>
          <p className="text-xs text-brown-light">
            {naira(unit)} each{unit < v.price ? ' · wholesale price applied' : ''}
          </p>
        </div>
      </div>

      <p className="text-xs text-brown-light">
        {p.deliveryFee > 0 ? `Delivery: ${naira(p.deliveryFee)} per item (added at checkout)` : 'Free delivery'}
        {canBuy && v.available <= 10 ? ` · only ${v.available} left` : ''}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={addToCart} disabled={!canBuy} className="btn-peach">
          {canBuy ? 'Add to cart' : closed ? 'Basket closed' : 'Sold out'}
        </button>
        {added && (
          <Link href="/cart" className="text-sm font-medium underline">
            Added ✓ View cart
          </Link>
        )}
      </div>
    </div>
  );
}
