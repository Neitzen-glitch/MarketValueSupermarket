# Market Value Supermarket: online store

Next.js + Supabase (database, admin login, photo storage) + Paystack (payments) + Resend (emails) + Termii (SMS, optional).
Customers never create accounts. The owner manages everything from `/admin`.

**What it does**
- Shop front: catalog, product pages, cart, checkout (pay online with Paystack, or pay on delivery).
- Wholesale prices (price tiers), delivery fee set per product and charged per unit, baskets sold in shares.
- Admin (`/admin`, login required): add products and publish them instantly, stock, orders, subscribers.
- Receipt emailed automatically after payment (order confirmation email for pay-on-delivery).
- "Get stock alerts" box in the footer of every page (email and/or phone). When she publishes or restocks a product, subscribers get one combined email/SMS.
- Colors: off-white 60%, brown 30%, peach 10%. Font: Poppins (falls back to any sans-serif).

---

## 1. Run it on your computer

Needs Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local     # then fill in the values (steps 2 to 5 below)
npm run dev                    # http://localhost:3000
```

Until you fill in Resend and Termii, emails and SMS are just **printed in the terminal**, so you can test everything without them.

## 2. Supabase (database + admin login + photos)

1. Create a free project at supabase.com.
2. **SQL Editor** → New query → paste the whole of `db/schema.sql` → **Run**. (This creates every table, the stock functions, security rules and the `product-images` photo bucket.)
3. **Authentication → Users → Add user → Create new user**: her email and a strong password, tick **Auto Confirm User**.
4. **Authentication settings**: turn **off** "Allow new users to sign up". (Otherwise strangers could create accounts.)
5. Back in the **SQL Editor**, make her an admin (use her real email):
   ```sql
   insert into admin_users (id, email)
   select id, email from auth.users where email = 'her@email.com';
   ```
6. **Project Settings → API**: copy the Project URL, the `anon` key and the `service_role` key into `.env.local`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
   If your dashboard shows "publishable" and "secret" keys instead, use those the same way.
   **The service_role / secret key is a master key. Never post it publicly or commit it.**

Log in at `/admin/login`. The store starts empty: add products in **Admin → Products → New product**.

## 3. Paystack (payments)

1. paystack.com → Settings → **API Keys & Webhooks**. Copy the **Test Secret Key** (`sk_test_...`) into `PAYSTACK_SECRET_KEY`.
2. The site sends customers to Paystack's own payment page, so no public key is needed.
3. Test card: `4084 0840 8408 4081`, any future expiry, CVV `408` (if Paystack shows different test details, use theirs).
4. **Webhook**: set the **Test Webhook URL** to `https://YOUR-SITE/api/paystack/webhook`.
   On your own computer Paystack can't reach `localhost`. You don't need to test the webhook locally: when the customer returns to the order page, the site checks the payment with Paystack itself. The webhook is the safety net for customers who close the tab after paying.

**Going live for the shop:** she needs her own activated Paystack account. Then replace `PAYSTACK_SECRET_KEY` with her **live** secret key and set the **Live Webhook URL**. Nothing else changes.

## 4. Email (Resend)

1. resend.com → create an API key → `RESEND_API_KEY`.
2. Until you verify a domain (Resend → Domains), Resend only delivers to your own account email. To email real customers, verify a domain and set
   `EMAIL_FROM="Market Value Supermarket <orders@yourdomain.com>"`.

## 5. SMS (Termii, optional)

Leave `TERMII_API_KEY` empty to skip SMS (it prints to the terminal). To send real SMS: create a Termii account, register a **Sender ID** (approval takes a while), then fill `TERMII_API_KEY` and `TERMII_SENDER_ID`. Test with real phone numbers early: delivery depends on Termii's routes and on DND-listed numbers.

## 6. Background jobs (important)

Two things must run every few minutes: releasing stock held by abandoned checkouts (15-minute hold) and sending the combined stock alert once she has stopped editing for 10 minutes.

1. Set `CRON_SECRET` to a long random string.
2. Create a free job at **cron-job.org**: URL `https://YOUR-SITE/api/cron`, every 5 minutes, with the request header `Authorization: Bearer YOUR_CRON_SECRET`.

(`vercel.json` also runs it once a day as a backup, which is the most Vercel's free plan allows. Expired holds are also cleaned on every checkout, and the admin dashboard has a **Send alerts now** button.)

## 7. Put it online (Vercel)

1. Push this folder to a private GitHub repo.
2. vercel.com → Add New Project → import the repo.
3. Add **every** variable from `.env.example` under Environment Variables. Set `NEXT_PUBLIC_SITE_URL` to the final address (no trailing slash).
4. Deploy. If you change a `NEXT_PUBLIC_` value later, redeploy.
5. Set the Paystack webhook URL (step 3) and the cron job (step 6) to the live address.

## 8. Test checklist (do this before showing the client)

- [ ] `/admin/login` works; a random visitor is bounced from `/admin`.
- [ ] Add a product with a photo, two variants, a wholesale tier and a delivery fee, set to **Published**. It appears on the home page immediately.
- [ ] Add a basket sold in shares; buy shares until it closes.
- [ ] Buy online with the Paystack test card. You land on the order page as **paid**, a receipt email arrives (or prints), and stock drops.
- [ ] Buy with **Pay on delivery**: confirmation email, stock drops, order shows in Admin → Orders.
- [ ] Start an online checkout and abandon it; after 15 minutes (cron) the stock returns.
- [ ] Subscribe from the footer; publish a product with "Notify subscribers" ticked; the alert goes out after the quiet period (or press **Send alerts now**).
- [ ] The Unsubscribe link in an email works.

## 9. Handing over to the shop owner

- Her own Paystack account: live secret key + live webhook URL.
- Her own Resend domain/`EMAIL_FROM`, and a Termii sender ID if she wants SMS.
- Give her the admin login (and tell her to change the password).
- Show her: **Products → New product** (fill in, tick "Notify subscribers", Save), **Mark sold out**, **Orders** (Mark out for delivery / delivered / cancel), **Copy summary** to paste an order into WhatsApp.

## 10. Good to know

- **Money paths:** prices, delivery and stock are always recomputed on the server from the database; payments are confirmed by asking Paystack, never by trusting the browser; webhooks are signature-checked and processed once; stock reservations are atomic so two people can't buy the last item.
- **Not included:** automatic refunds (refund from the Paystack dashboard), customer order history, bot protection. Someone could open many checkouts to hold stock for 15 minutes each; if that ever happens, add Cloudflare or Vercel's firewall rules.
- **Privacy:** subscribers must tick a consent box, every email/SMS carries an unsubscribe link, and product photos are public.

## Project map

```
app/(store)/      shop pages: home, products/[slug], cart, checkout, order/[id], unsubscribe/[token]
app/admin/        login + (panel): dashboard, products, orders, subscribers; actions.ts = every admin action
app/api/          checkout, paystack/webhook, cron
components/       UI (admin forms in components/admin)
lib/              orders.ts (checkout, payments, stock), notify.ts (alerts), pricing.ts, paystack.ts, email.ts, sms.ts
db/schema.sql     the whole database
middleware.ts     first gate for /admin (pages and actions re-check admin status)
```
