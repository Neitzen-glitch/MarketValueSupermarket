const STYLES: Record<string, string> = {
  pending: 'bg-peach-light text-brown',
  paid: 'bg-brown text-cream',
  confirmed: 'bg-brown text-cream',
  out_for_delivery: 'bg-peach text-brown-dark',
  delivered: 'bg-cream-dark text-brown',
  cancelled: 'bg-brown/10 text-brown-light',
  expired: 'bg-brown/10 text-brown-light',
  draft: 'bg-cream-dark text-brown-light',
  published: 'bg-peach text-brown-dark',
};
const LABELS: Record<string, string> = { out_for_delivery: 'Out for delivery' };

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STYLES[status] ?? 'bg-cream-dark'}`}>
      {LABELS[status] ?? status.replace(/_/g, ' ')}
    </span>
  );
}
