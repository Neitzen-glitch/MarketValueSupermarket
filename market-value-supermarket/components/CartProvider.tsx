'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { CartLine } from '@/lib/pricing';

export type CartItem = CartLine & { slug: string; imageUrl: string | null; maxQty: number };
type CartCtx = {
  items: CartItem[];
  ready: boolean;
  count: number;
  add: (item: CartItem) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
};
const Ctx = createContext<CartCtx | null>(null);
const KEY = 'mv-cart-v1';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {}
  }, [items, ready]);

  const add = useCallback((i: CartItem) => {
    setItems((cur) => {
      const ex = cur.find((c) => c.variantId === i.variantId);
      if (!ex) return [...cur, { ...i, quantity: Math.min(i.quantity, i.maxQty) }];
      return cur.map((c) => (c.variantId === i.variantId ? { ...i, quantity: Math.min(c.quantity + i.quantity, i.maxQty) } : c));
    });
  }, []);
  const setQty = useCallback((id: string, qty: number) => {
    setItems((cur) => cur.map((c) => (c.variantId === id ? { ...c, quantity: Math.max(1, Math.min(qty, c.maxQty)) } : c)));
  }, []);
  const remove = useCallback((id: string) => setItems((cur) => cur.filter((c) => c.variantId !== id)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({ items, ready, count: items.reduce((s, i) => s + i.quantity, 0), add, setQty, remove, clear }),
    [items, ready, add, setQty, remove, clear],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCart must be used inside CartProvider');
  return c;
}
