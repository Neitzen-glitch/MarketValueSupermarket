import { naira } from './money';
import { siteUrl } from './site';

export const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const C = { cream: '#FAF5EE', brown: '#5A3825', peach: '#FFB997', light: '#8A6450' };

function wrap(title: string, body: string, footer = '') {
  return `<!doctype html><html><body style="margin:0;background:${C.cream};font-family:Poppins,Arial,sans-serif;color:${C.brown}">
<div style="max-width:560px;margin:0 auto;padding:24px">
  <div style="background:${C.brown};color:${C.cream};padding:20px 24px;border-radius:16px 16px 0 0">
    <div style="font-size:20px;font-weight:700">Market Value</div>
    <div style="font-size:11px;letter-spacing:.2em;color:${C.peach};text-transform:uppercase">Supermarket</div>
  </div>
  <div style="background:#fff;padding:24px;border-radius:0 0 16px 16px">
    <h1 style="font-size:20px;margin:0 0 14px">${title}</h1>${body}
  </div>
  <p style="font-size:12px;color:${C.light};text-align:center;margin:16px 0 0">${footer}</p>
</div></body></html>`;
}

// kind 'receipt' = paid online. kind 'cod' = pay on delivery confirmation.
export function orderEmail(o: any, kind: 'receipt' | 'cod') {
  const rows = (o.order_items ?? [])
    .map(
      (i: any) => `<tr>
<td style="padding:10px 0;border-bottom:1px solid #eee">${esc(i.product_name)} <span style="color:${C.light}">· ${esc(i.variant_name)}</span><br>
<span style="color:${C.light};font-size:12px">${i.quantity} × ${naira(i.unit_price)}${i.delivery_fee ? ` + delivery ${naira(i.delivery_fee * i.quantity)}` : ''}</span></td>
<td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${naira(i.line_total)}</td></tr>`,
    )
    .join('');
  const intro =
    kind === 'receipt'
      ? `<p style="margin:0 0 16px">Hi ${esc(o.customer_name)}, we have received your payment. Thank you for shopping with us!</p>`
      : `<p style="margin:0 0 16px">Hi ${esc(o.customer_name)}, your order is confirmed. Please pay <b>${naira(o.total)}</b> (cash or transfer) when it arrives.</p>`;
  const body = `${intro}
<p style="margin:0 0 4px;font-size:13px;color:${C.light}">Order number</p><p style="margin:0 0 16px;font-weight:600">${esc(o.order_number)}</p>
<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}
<tr><td style="padding:10px 0">Subtotal</td><td style="text-align:right">${naira(o.subtotal)}</td></tr>
<tr><td style="padding:2px 0 10px">Delivery</td><td style="text-align:right">${naira(o.delivery_total)}</td></tr>
<tr><td style="padding:10px 0;border-top:2px solid ${C.brown};font-weight:700">${kind === 'receipt' ? 'Total paid' : 'Total to pay on delivery'}</td><td style="text-align:right;border-top:2px solid ${C.brown};font-weight:700">${naira(o.total)}</td></tr></table>
<p style="margin:20px 0 4px;font-size:13px;color:${C.light}">Delivering to</p><p style="margin:0">${esc(o.customer_name)}<br>${esc(o.delivery_address)}<br>${esc(o.customer_phone)}</p>`;
  return {
    subject: kind === 'receipt' ? `Your receipt ${o.order_number} · Market Value Supermarket` : `Order ${o.order_number} confirmed · Market Value Supermarket`,
    html: wrap(kind === 'receipt' ? 'Payment received' : 'Order confirmed', body, 'Market Value Supermarket'),
  };
}

export function digestEmail(items: { name: string; from: number; url: string }[], unsubscribeUrl: string) {
  const rows = items
    .map(
      (i) => `<tr><td style="padding:12px 0;border-bottom:1px solid #eee"><b>${esc(i.name)}</b><br><span style="color:${C.light};font-size:13px">From ${naira(i.from)}</span></td>
<td style="padding:12px 0;border-bottom:1px solid #eee;text-align:right"><a href="${esc(i.url)}" style="background:${C.peach};color:#3E2518;text-decoration:none;font-weight:600;font-size:13px;padding:8px 16px;border-radius:999px">Order</a></td></tr>`,
    )
    .join('');
  return {
    subject: 'Fresh stock just landed at Market Value Supermarket',
    html: wrap(
      'Fresh stock just landed',
      `<p style="margin:0 0 12px">Now available:</p><table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
<p style="margin:20px 0 0"><a href="${siteUrl()}" style="color:${C.brown}">See everything in stock →</a></p>`,
      `You are receiving this because you joined our stock alerts. <a href="${esc(unsubscribeUrl)}" style="color:${C.light}">Unsubscribe</a>`,
    ),
  };
}
