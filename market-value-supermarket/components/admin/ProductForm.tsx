'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveProduct } from '@/app/admin/actions';

type Tier = { minQty: string; price: string };
type Variant = { id: string | null; name: string; price: string; stock: string; tiers: Tier[] };
type Basket = { enabled: boolean; totalShares: string; sharePrice: string; sharesLeft: string; open: boolean };
export type ProductFormInitial = {
  id: string | null;
  name: string;
  category: string;
  description: string;
  deliveryFee: string;
  deliveryNote: string;
  status: 'draft' | 'published';
  imageUrl: string | null;
  variants: Variant[];
  basket: Basket;
};

// Phone photos are big: shrink to 1200px JPEG in the browser before uploading.
async function shrink(file: File, max = 1200): Promise<File> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.82));
  return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
}

const emptyVariant = (): Variant => ({ id: null, name: '', price: '', stock: '', tiers: [] });

export default function ProductForm({ initial }: { initial: ProductFormInitial }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(initial.imageUrl);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof ProductFormInitial>(k: K, v: ProductFormInitial[K]) => setF((s) => ({ ...s, [k]: v }));
  const setVariant = (i: number, patch: Partial<Variant>) => setF((s) => ({ ...s, variants: s.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) }));
  const setTier = (i: number, t: number, patch: Partial<Tier>) =>
    setF((s) => ({ ...s, variants: s.variants.map((v, j) => (j === i ? { ...v, tiers: v.tiers.map((x, k) => (k === t ? { ...x, ...patch } : x)) } : v)) }));
  const setBasket = (patch: Partial<Basket>) => setF((s) => ({ ...s, basket: { ...s.basket, ...patch } }));

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const small = await shrink(file);
      setImage(small);
      setPreview(URL.createObjectURL(small));
    } catch {
      setError('Could not read that photo. Try a JPG or PNG.');
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const fd = new FormData();
    fd.set(
      'payload',
      JSON.stringify({
        id: f.id,
        name: f.name,
        category: f.category,
        description: f.description,
        deliveryFee: f.deliveryFee || 0,
        deliveryNote: f.deliveryNote,
        status: f.status,
        notify: notify && f.status === 'published',
        variants: f.variants.map((v) => ({
          id: v.id,
          name: v.name,
          price: v.price,
          stock: v.stock || 0,
          tiers: v.tiers.filter((t) => t.minQty && t.price).map((t) => ({ minQty: t.minQty, price: t.price })),
        })),
        basket: f.basket,
      }),
    );
    if (image) fd.set('image', image);
    const res = await saveProduct(fd);
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    router.push('/admin/products');
    router.refresh();
  }

  const section = 'card space-y-4 p-5';
  return (
    <form onSubmit={submit} className="space-y-6">
      <section className={section}>
        <h2 className="font-semibold">Basics</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Product name</label>
            <input value={f.name} onChange={(e) => set('name', e.target.value)} required className="input" placeholder="Fresh tomato basket" />
          </div>
          <div>
            <label className="label">Category (optional)</label>
            <input value={f.category} onChange={(e) => set('category', e.target.value)} className="input" placeholder="Vegetables" />
          </div>
        </div>
        <div>
          <label className="label">Description (optional)</label>
          <textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={3} className="input" />
        </div>
        <div className="flex items-center gap-4">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-peach-light">{preview && <img src={preview} alt="" className="h-full w-full object-cover" />}</div>
          <div>
            <label className="label">Photo</label>
            <input type="file" accept="image/*" onChange={onPhoto} className="text-sm" />
          </div>
        </div>
      </section>

      <section className={section}>
        <h2 className="font-semibold">Delivery</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Delivery fee per item (₦). Enter 0 for free</label>
            <input type="number" min="0" step="0.01" inputMode="decimal" value={f.deliveryFee} onChange={(e) => set('deliveryFee', e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Delivery note (optional)</label>
            <input value={f.deliveryNote} onChange={(e) => set('deliveryNote', e.target.value)} className="input" placeholder="Enugu metro only" />
          </div>
        </div>
        <p className="text-xs text-brown-light">The fee is multiplied by the quantity the customer buys.</p>
      </section>

      <section className={section}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Options, stock and prices</h2>
          <button type="button" className="btn-outline" onClick={() => setF((s) => ({ ...s, variants: [...s.variants, emptyVariant()] }))}>
            + Add option
          </button>
        </div>
        <p className="text-xs text-brown-light">An option is what the customer actually buys, e.g. "Full basket", "Half basket", "5 litre".</p>
        {f.variants.map((v, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-brown/10 bg-cream p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_130px_110px_auto]">
              <div>
                <label className="label">Option name</label>
                <input value={v.name} onChange={(e) => setVariant(i, { name: e.target.value })} className="input" placeholder="Full basket" />
              </div>
              <div>
                <label className="label">Price (₦)</label>
                <input type="number" min="0" step="0.01" inputMode="decimal" value={v.price} onChange={(e) => setVariant(i, { price: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">In stock</label>
                <input type="number" min="0" step="1" inputMode="numeric" value={v.stock} onChange={(e) => setVariant(i, { stock: e.target.value })} className="input" />
              </div>
              <div className="flex items-end">
                <button type="button" className="text-xs text-brown-light underline" onClick={() => setF((s) => ({ ...s, variants: s.variants.filter((_, j) => j !== i) }))}>
                  Remove
                </button>
              </div>
            </div>
            {v.tiers.map((t, k) => (
              <div key={k} className="flex flex-wrap items-end gap-3 pl-3">
                <div className="w-28">
                  <label className="label">Buy this many or more</label>
                  <input type="number" min="2" step="1" value={t.minQty} onChange={(e) => setTier(i, k, { minQty: e.target.value })} className="input" />
                </div>
                <div className="w-36">
                  <label className="label">Price each (₦)</label>
                  <input type="number" min="0" step="0.01" value={t.price} onChange={(e) => setTier(i, k, { price: e.target.value })} className="input" />
                </div>
                <button type="button" className="pb-2 text-xs text-brown-light underline" onClick={() => setVariant(i, { tiers: v.tiers.filter((_, j) => j !== k) })}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className="pl-3 text-xs font-medium underline" onClick={() => setVariant(i, { tiers: [...v.tiers, { minQty: '', price: '' }] })}>
              + Add wholesale price
            </button>
          </div>
        ))}
      </section>

      <section className={section}>
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={f.basket.enabled} onChange={(e) => setBasket({ enabled: e.target.checked, ...(e.target.checked && !f.basket.totalShares ? { totalShares: '10', sharesLeft: '10' } : {}) })} className="accent-[#5A3825]" />
          Sell shares of a basket
        </label>
        {f.basket.enabled && (
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="label">Total shares</label>
              <input type="number" min="1" step="1" value={f.basket.totalShares} onChange={(e) => setBasket({ totalShares: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Price per share (₦)</label>
              <input type="number" min="0" step="0.01" value={f.basket.sharePrice} onChange={(e) => setBasket({ sharePrice: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Shares still available</label>
              <input type="number" min="0" step="1" value={f.basket.sharesLeft} onChange={(e) => setBasket({ sharesLeft: e.target.value })} className="input" />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" checked={f.basket.open} onChange={(e) => setBasket({ open: e.target.checked })} className="accent-[#5A3825]" /> Open for sale
            </label>
          </div>
        )}
        {f.basket.enabled && <p className="text-xs text-brown-light">The basket closes by itself when the last share sells. Tick "Open for sale" again after topping up shares.</p>}
      </section>

      <section className={section}>
        <h2 className="font-semibold">Publish</h2>
        <div className="flex flex-wrap gap-6 text-sm">
          {(
            [
              ['published', 'Published (visible on the shop now)'],
              ['draft', 'Draft (hidden)'],
            ] as const
          ).map(([val, label]) => (
            <label key={val} className="flex items-center gap-2">
              <input type="radio" name="status" checked={f.status === val} onChange={() => set('status', val)} className="accent-[#5A3825]" /> {label}
            </label>
          ))}
        </div>
        {f.status === 'published' && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-[#5A3825]" />
            Notify subscribers about new or restocked items
          </label>
        )}
      </section>

      {error && <p className="rounded-xl bg-peach-light p-4 text-sm font-medium">{error}</p>}
      <div className="flex gap-3">
        <button disabled={busy} className="btn-brown">
          {busy ? 'Saving…' : f.id ? 'Save changes' : 'Add product'}
        </button>
        <button type="button" className="btn-outline" onClick={() => router.push('/admin/products')}>
          Cancel
        </button>
      </div>
    </form>
  );
}
