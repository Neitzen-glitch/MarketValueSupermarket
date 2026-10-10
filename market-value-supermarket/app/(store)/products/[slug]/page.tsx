import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/supabase/service';
import { one } from '@/lib/types';
import { availableOf } from '@/lib/catalog';
import AddToCart from '@/components/AddToCart';
import { naira } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: p } = await db()
    .from('products')
    .select('id, name, slug, description, image_url, category, delivery_fee, delivery_note, variants(id, name, price, stock, reserved, sort_order, price_tiers(min_qty, price)), baskets(status, share_variant_id, total_shares)')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  if (!p) notFound();

  const basket: any = one(p.baskets);
  const variants = [...(p.variants as any[])].sort((a, b) => a.sort_order - b.sort_order);
  const shareVariant = basket ? variants.find((v) => v.id === basket.share_variant_id) : null;

  return (
    <div>
      <Link href="/" className="text-sm text-brown-light hover:underline">
        ← All products
      </Link>
      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div className="overflow-hidden rounded-3xl bg-peach-light">
          {p.image_url ? (
            <img src={p.image_url} alt={p.name} className="aspect-square w-full object-cover" />
          ) : (
            <div className="flex aspect-square items-center justify-center text-8xl font-semibold text-brown/20">{p.name.charAt(0)}</div>
          )}
        </div>
        <div className="space-y-5">
          <div>
            {p.category && <span className="text-xs font-medium uppercase tracking-wider text-brown-light">{p.category}</span>}
            <h1 className="mt-1 text-3xl font-bold">{p.name}</h1>
          </div>
          {p.description && <p className="whitespace-pre-line text-sm leading-relaxed text-brown/90">{p.description}</p>}
          <div className="rounded-xl border border-brown/10 bg-cream-dark/60 p-4 text-sm">
            <p className="font-semibold">Delivery</p>
            <p className="mt-0.5">{p.delivery_fee > 0 ? `${naira(p.delivery_fee)} per item` : 'Free'}</p>
            {p.delivery_note && <p className="mt-0.5 text-brown-light">{p.delivery_note}</p>}
          </div>
          <AddToCart
            productId={p.id}
            slug={p.slug}
            productName={p.name}
            imageUrl={p.image_url}
            deliveryFee={p.delivery_fee}
            variants={variants.map((v) => ({
              id: v.id,
              name: v.name,
              price: v.price,
              available: availableOf(v),
              tiers: (v.price_tiers ?? []).map((t: any) => ({ minQty: t.min_qty, price: t.price })),
              isShare: !!basket && v.id === basket.share_variant_id,
            }))}
            basket={basket && shareVariant ? { totalShares: basket.total_shares, sharesLeft: availableOf(shareVariant), open: basket.status === 'open' } : null}
          />
        </div>
      </div>
    </div>
  );
}
