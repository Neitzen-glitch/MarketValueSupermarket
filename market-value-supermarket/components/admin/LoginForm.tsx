'use client';
import { useActionState } from 'react';
import { signIn } from '@/app/admin/actions';

export default function LoginForm() {
  const [state, action, pending] = useActionState(signIn, { error: '' });
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label">Email</label>
        <input name="email" type="email" required autoComplete="username" className="input" />
      </div>
      <div>
        <label className="label">Password</label>
        <input name="password" type="password" required autoComplete="current-password" className="input" />
      </div>
      {state.error && <p className="rounded-lg bg-peach-light p-3 text-sm font-medium">{state.error}</p>}
      <button disabled={pending} className="btn-brown w-full">
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
