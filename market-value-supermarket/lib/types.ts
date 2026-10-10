export type OrderStatus = 'pending' | 'paid' | 'confirmed' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'expired';

// PostgREST returns one object or an array depending on the relationship; normalise to one.
export function one<T>(x: T | T[] | null | undefined): T | null {
  return Array.isArray(x) ? (x[0] ?? null) : (x ?? null);
}
