import Link from 'next/link';
import { db } from '@/lib/supabase/service';
import { availableOf } from '@/lib/catalog';
import StatusBadge from '@/components/StatusBadge';
import ConfirmButton from '@/components/admin/ConfirmButton';
import { deleteProduct, markSoldOut, setProductStatus } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Products' };

export default async function ProductsPage() {
  const { data } = await db().from('products').select('id, name, status, image_url, variants(stock, reserved)').order('created_at', { ascending: false });
  const products = data ?? [];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        <Link href="/admin/products/new" className="btn-brown">+ Add a product</Link>
      </div>
      {products.length === 0 ? (
        <div className="card p-10 text-center text-sm text-brown-light">No products yet. Add your first one and it appears on the shop straight away.</div>
      ) : (
        <ul className="space-y-3">
          {products.map((p: any) => {
            const left = (p.variants ?? []).reduce((s: number, v: any) => s + availableOf(v), 0);
            return (
              <li key={p.id} className="card flex flex-wrap items-center gap-4 p-4">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-peach-light">{p.image_url && <img src={p.image_url} alt="" className="h-full w-full object-cover" />}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-xs text-brown-light">{(p.variants ?? []).length} option(s) · {left} available</p>
                </div>
                <StatusBadge status={p.status} />
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Link href={`/admin/products/${p.id}`} className="font-medium underline">Edit</Link>
                  <form action={setProductStatus.bind(null, p.id, p.status === 'published' ? 'draft' : 'published')}>
                    <button className="underline">{p.status === 'published' ? 'Hide' : 'Publish'}</button>
                  </form>
                  <form action={markSoldOut.bind(null, p.id)}>
                    <ConfirmButton message="Mark everything in this product as sold out?" className="underline">Mark sold out</ConfirmButton>
                  </form>
                  <form action={deleteProduct.bind(null, p.id)}>
                    <ConfirmButton message="Delete this product for good? Past orders keep their details." className="text-brown-light underline">Delete</ConfirmButton>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
