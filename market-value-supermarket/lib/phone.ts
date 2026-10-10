// Accepts 0803 123 4567, +234 803 123 4567, 2348031234567 and returns 2348031234567 (or null).
export function normalizeNgPhone(input: string): string | null {
  const d = input.replace(/[\s\-()]/g, '');
  const m = d.match(/^(?:\+?234|0)([789][01]\d{8})$/);
  return m ? '234' + m[1] : null;
}
export const displayPhone = (p: string) => (p.startsWith('234') ? '0' + p.slice(3) : p);
