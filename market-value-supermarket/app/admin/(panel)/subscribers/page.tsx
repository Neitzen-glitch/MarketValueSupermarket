import { db } from '@/lib/supabase/service';
import { displayPhone } from '@/lib/phone';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Subscribers' };

export default async function SubscribersPage() {
  const { data } = await db().from('subscribers').select('id, email, phone, email_consent, sms_consent, unsubscribed_at, created_at').order('created_at', { ascending: false }).limit(500);
  const subs = data ?? [];
  const active = subs.filter((s: any) => !s.unsubscribed_at).length;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscribers</h1>
        <p className="text-sm text-brown-light">{active} active · {subs.length - active} unsubscribed (showing the latest 500)</p>
      </div>
      {subs.length === 0 ? (
        <div className="card p-10 text-center text-sm text-brown-light">Nobody has joined yet. The sign-up box is at the bottom of every shop page.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-brown-light">
              <tr><th className="p-3">Email</th><th className="p-3">Phone</th><th className="p-3">Joined</th><th className="p-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-brown/10">
              {subs.map((s: any) => (
                <tr key={s.id}>
                  <td className="p-3">{s.email ?? '—'}</td>
                  <td className="p-3">{s.phone ? displayPhone(s.phone) : '—'}</td>
                  <td className="p-3 text-brown-light">{new Date(s.created_at).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'medium' })}</td>
                  <td className="p-3">{s.unsubscribed_at ? 'Unsubscribed' : 'Active'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
