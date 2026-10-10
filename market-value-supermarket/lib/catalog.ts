import { one } from './types';

export type CatalogVariant = {
  id: string;
  name: string;
  price: number;
  stock: number;
  reserved: number;
  price_tiers?: { min_qty: number; price: number }[];
};
export type CatalogBasket = { status: string; share_variant_id: string; total_shares?: number };

export const availableOf = (v: { stock: number; reserved: number }) => Math.max(v.stock - v.reserved, 0);

export function sellableVariants(variants: CatalogVariant[], basketRaw: unknown): CatalogVariant[] {
  const basket = one(basketRaw as CatalogBasket | CatalogBasket[] | null);
  return variants.filter(
    (v) => availableOf(v) > 0 && !(basket && basket.status === 'closed' && basket.share_variant_id === v.id),
  );
}

export function summarize(p: { variants?: CatalogVariant[]; baskets?: unknown }) {
  const variants = p.variants ?? [];
  const sellable = sellableVariants(variants, p.baskets);
  const pool = sellable.length ? sellable : variants;
  const from = pool.length ? Math.min(...pool.map((v) => v.price)) : 0;
  const left = sellable.reduce((s, v) => s + availableOf(v), 0);
  return { soldOut: sellable.length === 0, from, left, hasTiers: variants.some((v) => (v.price_tiers?.length ?? 0) > 0) };
}
