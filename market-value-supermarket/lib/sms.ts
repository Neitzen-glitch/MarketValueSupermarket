import 'server-only';

// Termii (Nigerian SMS). Phone numbers are stored as 234XXXXXXXXXX, which is what Termii expects.
// With no TERMII_API_KEY set, messages are printed to the server console instead of being sent.
export async function sendSms(to: string, message: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const key = process.env.TERMII_API_KEY;
  if (!key) {
    console.log(`[sms dev mode] to ${to} | ${message}`);
    return { ok: true, id: 'dev' };
  }
  try {
    const res = await fetch(`${process.env.TERMII_BASE_URL || 'https://api.ng.termii.com'}/api/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        from: process.env.TERMII_SENDER_ID,
        sms: message,
        type: 'plain',
        channel: process.env.TERMII_CHANNEL || 'generic',
        api_key: key,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && (json.code === 'ok' || json.message_id)) return { ok: true, id: json.message_id };
    return { ok: false, error: json.message || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'SMS failed' };
  }
}
