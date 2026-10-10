import Link from 'next/link';
import { summarize, type CatalogVariant } from '@/lib/catalog';
import { naira } from '@/lib/money';

type P = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  category: string | null;
  delivery_fee: number;
  variants: CatalogVariant[];
  baskets?: unknown;
};

export default function ProductCard({ p }: { p: P }) {
  const s = summarize(p);
  return (
    <Link href={`/products/${p.slug}`} className="group card flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[4/3] bg-peach-light">
        {p.image_url ? (
          <img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl font-semibold text-brown/25">{p.name.charAt(0)}</div>
        )}
        {s.soldOut && <span className="absolute left-3 top-3 rounded-full bg-brown px-3 py-1 text-xs font-medium text-cream">Sold out</span>}
        {!s.soldOut && s.left <= 5 && (
          <span className="absolute left-3 top-3 rounded-full bg-peach px-3 py-1 text-xs font-semibold text-brown-dark">Only {s.left} left</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        {p.category && <span className="text-[11px] font-medium uppercase tracking-wider text-brown-light">{p.category}</span>}
        <h3 className="mt-0.5 font-semibold group-hover:underline">{p.name}</h3>
        <p className="mt-2 text-lg font-bold">
          {p.variants.length > 1 ? 'From ' : ''}
          {naira(s.from)}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
          {s.hasTiers && <span className="rounded-full bg-peach-light px-2 py-0.5 font-medium">Wholesale prices</span>}
          <span className="rounded-full bg-cream-dark px-2 py-0.5">{p.delivery_fee > 0 ? `Delivery ${naira(p.delivery_fee)} each` : 'Free delivery'}</span>
        </div>
      </div>
    </Link>
  );
}
