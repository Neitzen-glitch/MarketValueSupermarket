import Link from 'next/link';
import { db } from '@/lib/supabase/service';
import ProductCard from '@/components/ProductCard';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;
  const { data } = await db()
    .from('products')
    .select('id, name, slug, image_url, category, delivery_fee, variants(id, name, price, stock, reserved, price_tiers(min_qty, price)), baskets(status, share_variant_id)')
    .eq('status', 'published')
    .order('created_at', { ascending: false });
  const all = data ?? [];
  const cats = [...new Set(all.map((p: any) => p.category).filter(Boolean))] as string[];
  const products = cat ? all.filter((p: any) => p.category === cat) : all;

  return (
    <div className="space-y-10">
      <section className="rounded-3xl bg-brown px-6 py-10 text-cream md:px-12">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-peach">Wholesale &amp; retail</p>
        <h1 className="mt-2 max-w-xl text-3xl font-bold leading-tight md:text-4xl">Fresh from Market Value Supermarket</h1>
        <p className="mt-3 max-w-lg text-sm text-cream/80">
          Baskets, shares, oil and more. Order online, pay by card or transfer, or pay when it arrives.
        </p>
        <a href="#products" className="btn-peach mt-6">
          Shop now
        </a>
      </section>

      <section id="products" className="scroll-mt-24">
        {cats.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2 text-sm">
            <Link href="/" className={`rounded-full px-4 py-1.5 ${!cat ? 'bg-brown text-cream' : 'border border-brown/20 hover:bg-cream-dark'}`}>
              All
            </Link>
            {cats.map((c) => (
              <Link
                key={c}
                href={`/?cat=${encodeURIComponent(c)}`}
                className={`rounded-full px-4 py-1.5 ${cat === c ? 'bg-brown text-cream' : 'border border-brown/20 hover:bg-cream-dark'}`}
              >
                {c}
              </Link>
            ))}
          </div>
        )}

        {products.length === 0 ? (
          <div className="card px-6 py-16 text-center">
            <p className="text-lg font-semibold">Fresh stock is coming soon</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-brown-light">
              We are getting our shelves ready. Leave your email or phone number at the bottom of this page and we will tell you the moment it lands.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p: any) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
