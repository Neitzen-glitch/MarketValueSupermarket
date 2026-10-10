'use client';
import { useState, useTransition } from 'react';
import { subscribe } from '@/app/actions/newsletter';

export default function NewsletterForm() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const r = await subscribe(fd);
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) form.reset();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="email" type="email" placeholder="Email address" autoComplete="email" className="input" />
        <input name="phone" type="tel" placeholder="Phone, e.g. 0803 123 4567" autoComplete="tel" className="input" />
      </div>
      {/* honeypot: real people never see or fill this */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <label className="flex items-start gap-2 text-xs text-cream/80">
        <input type="checkbox" name="consent" className="mt-0.5 accent-[#FFB997]" />
        <span>I agree to receive stock updates from Market Value Supermarket by email and/or SMS. I can unsubscribe at any time.</span>
      </label>
      <button disabled={pending} className="btn-peach w-full sm:w-auto">
        {pending ? 'Joining…' : 'Notify me'}
      </button>
      {msg && <p className={`text-sm ${msg.ok ? 'text-peach' : 'text-cream'}`}>{msg.text}</p>}
    </form>
  );
}
