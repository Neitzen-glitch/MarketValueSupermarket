import { notFound } from 'next/navigation';
import { db } from '@/lib/supabase/service';
import { one } from '@/lib/types';
import { toNaira } from '@/lib/money';
import ProductForm from '@/components/admin/ProductForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit product' };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: p } = await db()
    .from('products')
    .select('*, variants(id, name, price, stock, reserved, sort_order, price_tiers(min_qty, price)), baskets(id, status, share_variant_id, total_shares)')
    .eq('id', id)
    .maybeSingle();
  if (!p) notFound();

  const basket: any = one(p.baskets);
  const variants = [...(p.variants as any[])].filter((v) => v.id !== basket?.share_variant_id).sort((a, b) => a.sort_order - b.sort_order);
  const shareVariant = basket ? (p.variants as any[]).find((v) => v.id === basket.share_variant_id) : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit product</h1>
      <ProductForm
        initial={{
          id: p.id,
          name: p.name,
          category: p.category ?? '',
          description: p.description ?? '',
          deliveryFee: String(toNaira(p.delivery_fee)),
          deliveryNote: p.delivery_note ?? '',
          status: p.status,
          imageUrl: p.image_url,
          // "In stock" = units not yet sold (this includes any briefly held for unpaid checkouts)
          variants: variants.map((v) => ({
            id: v.id,
            name: v.name,
            price: String(toNaira(v.price)),
            stock: String(v.stock),
            tiers: (v.price_tiers ?? []).map((t: any) => ({ minQty: String(t.min_qty), price: String(toNaira(t.price)) })),
          })),
          basket: basket && shareVariant
            ? {
                enabled: true,
                totalShares: String(basket.total_shares),
                sharePrice: String(toNaira(shareVariant.price)),
                sharesLeft: String(Math.max(shareVariant.stock - shareVariant.reserved, 0)),
                open: basket.status === 'open',
              }
            : { enabled: false, totalShares: '', sharePrice: '', sharesLeft: '', open: true },
        }}
      />
    </div>
  );
}
