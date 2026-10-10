import { NextResponse } from 'next/server';
import { expireStaleOrders } from '@/lib/orders';
import { sendPendingDigest } from '@/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Hit this every ~5 minutes. It (1) gives back stock held by abandoned checkouts and
// (2) sends the combined "fresh stock" alert once her edits have settled.
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? new URL(req.url).searchParams.get('key');
  if (!secret || given !== secret) return new NextResponse('unauthorized', { status: 401 });
  const expired = await expireStaleOrders();
  const digest = await sendPendingDigest();
  return NextResponse.json({ expired, digest });
}
export const GET = run;
export const POST = run;
