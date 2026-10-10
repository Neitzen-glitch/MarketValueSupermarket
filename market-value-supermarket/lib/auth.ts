import 'server-only';
import { redirect } from 'next/navigation';
import { authClient } from './supabase/server';
import { db } from './supabase/service';

// Logged in AND listed in admin_users. Customers never have accounts.
export async function getAdmin() {
  const supabase = await authClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await db().from('admin_users').select('id').eq('id', user.id).maybeSingle();
  return data ? user : null;
}

// Call this at the top of every admin page AND every admin server action:
// server actions are public endpoints, so the page-level check alone is not enough.
export async function requireAdmin() {
  const user = await getAdmin();
  if (!user) redirect('/admin/login');
  return user;
}
