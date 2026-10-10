import { notFound } from 'next/navigation';
import { unsubscribe } from '@/app/actions/newsletter';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Unsubscribe' };

export default async function UnsubscribePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string }> }) {
  const { token } = await params;
  const { done } = await searchParams;
  if (!/^[a-f0-9]{32}$/.test(token)) notFound();

  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      {done ? (
        <>
          <h1 className="text-xl font-bold">You have been unsubscribed</h1>
          <p className="mt-2 text-sm text-brown-light">You will not get any more stock alerts from us.</p>
        </>
      ) : (
        <>
          <h1 className="text-xl font-bold">Stop stock alerts?</h1>
          <p className="mt-2 text-sm text-brown-light">You will no longer get emails or SMS when new stock arrives.</p>
          <form action={unsubscribe.bind(null, token)} className="mt-5">
            <button className="btn-brown">Yes, unsubscribe me</button>
          </form>
        </>
      )}
    </div>
  );
}
