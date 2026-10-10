// All money is stored as integer KOBO (100 kobo = ₦1), which is what Paystack expects.
export function naira(kobo: number): string {
  const n = kobo / 100;
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
}
export const toKobo = (n: number | string) => Math.round(Number(n) * 100);
export const toNaira = (kobo: number) => kobo / 100;
