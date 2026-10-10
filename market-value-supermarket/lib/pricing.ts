// Amounts are integers in KOBO.
// The browser uses this only to DISPLAY totals. The server runs it again with prices loaded from
// the database at checkout, and that result is the only one that is charged.

export type Tier = { minQty: number; price: number };

export type CartLine = {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  quantity: number;
  basePrice: number; // variants.price
  tiers: Tier[]; // price_tiers rows for this variant
  deliveryFeePerUnit: number; // products.delivery_fee
};

export type PricedLine = CartLine & {
  unitPrice: number; // tier price applied to the whole quantity
  lineTotal: number; // unitPrice * quantity (goods only)
  deliveryTotal: number; // deliveryFeePerUnit * quantity
};

// The highest tier whose minQty the quantity reaches sets the unit price for ALL units.
export function unitPriceFor(basePrice: number, tiers: Tier[], quantity: number): number {
  let price = basePrice;
  let bestMin = 0;
  for (const t of tiers) {
    if (quantity >= t.minQty && t.minQty > bestMin) {
      bestMin = t.minQty;
      price = t.price;
    }
  }
  return price;
}

export function priceCart<T extends CartLine>(lines: T[]) {
  const priced = lines.map((l) => {
    if (!Number.isInteger(l.quantity) || l.quantity < 1) throw new Error(`Invalid quantity for ${l.productName}`);
    const unitPrice = unitPriceFor(l.basePrice, l.tiers, l.quantity);
    return { ...l, unitPrice, lineTotal: unitPrice * l.quantity, deliveryTotal: l.deliveryFeePerUnit * l.quantity };
  });
  const subtotal = priced.reduce((s, l) => s + l.lineTotal, 0);
  const deliveryTotal = priced.reduce((s, l) => s + l.deliveryTotal, 0);
  return { lines: priced, subtotal, deliveryTotal, total: subtotal + deliveryTotal };
}
