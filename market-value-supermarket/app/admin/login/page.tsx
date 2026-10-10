import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/auth';
import LoginForm from '@/components/admin/LoginForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin sign in', robots: { index: false } };

export default async function LoginPage() {
  if (await getAdmin()) redirect('/admin');
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brown-light">Market Value Supermarket</p>
        <h1 className="mb-6 mt-1 text-2xl font-bold">Shop admin</h1>
        <LoginForm />
      </div>
    </div>
  );
}
