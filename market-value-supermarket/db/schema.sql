-- Market Value store: Postgres schema (Supabase)
-- All money is stored in KOBO (integer), which is what Paystack expects.
-- Stock model:  available = stock - reserved
--   pending order  -> reserved += qty      (reserve_stock)
--   paid / COD confirmed -> stock -= qty, reserved -= qty   (commit_stock)
--   expired / cancelled before commit -> reserved -= qty     (release_stock)
--   cancelled after commit -> stock += qty (done in app code)

create extension if not exists pgcrypto;

create type product_status  as enum ('draft', 'published');
create type payment_method  as enum ('online', 'cod');
create type order_status    as enum ('pending', 'paid', 'confirmed', 'out_for_delivery',
                                     'delivered', 'cancelled', 'expired');
create type payment_status  as enum ('initiated', 'success', 'failed', 'abandoned');
create type basket_status   as enum ('open', 'closed');
create type stock_event_type as enum ('new_product', 'restock', 'basket_open');
create type channel         as enum ('email', 'sms');

-- ───────────── Admin (just her; Supabase Auth, sign-ups disabled) ─────────────
create table admin_users (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null unique,
  created_at timestamptz not null default now()
);

-- ───────────── Catalog ─────────────
create table products (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  description   text,
  image_url     text,
  category      text,
  delivery_fee  integer not null default 0 check (delivery_fee >= 0),  -- kobo PER UNIT, set per product in admin form
  delivery_note text,                                                  -- e.g. "Enugu metro only"
  status        product_status not null default 'draft',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on products (status, category);

create table variants (               -- the sellable unit: "Full basket", "5 litre", "1 share"
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name       text not null,
  price      integer not null check (price >= 0),        -- retail price, kobo
  stock      integer not null default 0 check (stock >= 0),
  reserved   integer not null default 0 check (reserved >= 0),
  sort_order integer not null default 0,
  check (reserved <= stock)
);
create index on variants (product_id);

create table price_tiers (            -- wholesale pricing: from min_qty upward, use this price
  id         uuid primary key default gen_random_uuid(),
  variant_id uuid not null references variants(id) on delete cascade,
  min_qty    integer not null check (min_qty >= 2),
  price      integer not null check (price >= 0),
  unique (variant_id, min_qty)
);

create table baskets (                -- a basket split into shares; shares are a variant, so
  id               uuid primary key default gen_random_uuid(),   -- reservation logic is one code path
  product_id       uuid not null references products(id) on delete cascade,
  share_variant_id uuid not null unique references variants(id) on delete cascade,
  total_shares     integer not null check (total_shares > 0),
  status           basket_status not null default 'open',
  closed_at        timestamptz
);

create view basket_progress with (security_invoker = true) as
select b.id, b.product_id, b.total_shares, b.status,
       v.stock - v.reserved            as shares_left,
       b.total_shares - v.stock        as shares_sold
from baskets b join variants v on v.id = b.share_variant_id;

-- ───────────── Orders & payments ─────────────
create sequence order_number_seq start 1001;

create table orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     text not null unique default ('MV-' || nextval('order_number_seq')),
  customer_name    text not null,
  customer_email   text not null,
  customer_phone   text not null,
  delivery_address text not null,
  payment_method   payment_method not null,
  status           order_status not null default 'pending',
  subtotal         integer not null check (subtotal >= 0),
  delivery_total   integer not null default 0 check (delivery_total >= 0),
  total            integer not null check (total >= 0),
  reserved_until   timestamptz,                 -- 15 min hold for pending orders
  receipt_sent_at  timestamptz,                 -- guards against duplicate receipts
  notes            text,
  created_at       timestamptz not null default now()
);
create index on orders (status, created_at desc);
create index on orders (status, reserved_until) where status = 'pending';

create table order_items (            -- everything copied at purchase time
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  variant_id    uuid references variants(id) on delete set null,
  product_name  text not null,
  variant_name  text not null,
  quantity      integer not null check (quantity > 0),
  unit_price    integer not null check (unit_price >= 0),   -- tier price applied
  delivery_fee  integer not null default 0,                 -- per-unit fee snapshot; line delivery = delivery_fee * quantity
  line_total    integer not null check (line_total >= 0)
);
create index on order_items (order_id);

create table payments (
  id                      uuid primary key default gen_random_uuid(),
  order_id                uuid not null references orders(id) on delete cascade,
  reference               text not null unique,             -- Paystack reference
  amount                  integer not null,
  status                  payment_status not null default 'initiated',
  paystack_transaction_id text,
  paid_at                 timestamptz,
  created_at              timestamptz not null default now()
);

create table webhook_events (          -- insert first; a unique-key conflict means "already handled"
  event_key    text primary key,       -- event type + ':' + reference
  event_type   text not null,
  payload      jsonb not null,
  processed_at timestamptz
);

-- ───────────── Newsletter ─────────────
create table subscribers (
  id                uuid primary key default gen_random_uuid(),
  email             text unique,
  phone             text unique,
  email_consent     boolean not null default false,
  sms_consent       boolean not null default false,
  consented_at      timestamptz not null default now(),
  unsubscribe_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  unsubscribed_at   timestamptz,
  created_at        timestamptz not null default now(),
  check (email is not null or phone is not null)
);

create table stock_events (            -- what changed; a job batches these into one digest
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  variant_id  uuid references variants(id) on delete cascade,
  event_type  stock_event_type not null,
  created_at  timestamptz not null default now(),
  notified_at timestamptz
);
create index on stock_events (created_at) where notified_at is null;

create table notification_log (
  id            uuid primary key default gen_random_uuid(),
  subscriber_id uuid references subscribers(id) on delete set null,
  channel       channel not null,
  status        text not null,          -- sent | failed
  provider_id   text,
  error         text,
  created_at    timestamptz not null default now()
);

-- ───────────── Atomic stock functions ─────────────
-- Call these inside one transaction per order so a multi-item cart reserves all-or-nothing.
create or replace function reserve_stock(p_variant uuid, p_qty int) returns boolean
language plpgsql as $$
begin
  update variants set reserved = reserved + p_qty
   where id = p_variant and stock - reserved >= p_qty;
  return found;                        -- false = not enough stock
end $$;

create or replace function release_stock(p_variant uuid, p_qty int) returns void
language sql as $$
  update variants set reserved = greatest(reserved - p_qty, 0) where id = p_variant;
$$;

create or replace function commit_stock(p_variant uuid, p_qty int) returns void
language sql as $$
  update variants set stock = stock - p_qty, reserved = greatest(reserved - p_qty, 0)
   where id = p_variant;
$$;

-- ───────────── Row Level Security ─────────────
-- The browser can only read published catalog data. Everything else (orders, payments,
-- subscribers, admin writes) goes through server routes using the service-role key.
alter table admin_users      enable row level security;
alter table products         enable row level security;
alter table variants         enable row level security;
alter table price_tiers      enable row level security;
alter table baskets          enable row level security;
alter table orders           enable row level security;
alter table order_items      enable row level security;
alter table payments         enable row level security;
alter table webhook_events   enable row level security;
alter table subscribers      enable row level security;
alter table stock_events     enable row level security;
alter table notification_log enable row level security;

create policy "public reads published products" on products
  for select using (status = 'published');
create policy "public reads variants of published products" on variants
  for select using (exists (select 1 from products p where p.id = product_id and p.status = 'published'));
create policy "public reads tiers of published products" on price_tiers
  for select using (exists (select 1 from variants v join products p on p.id = v.product_id
                            where v.id = variant_id and p.status = 'published'));
create policy "public reads baskets of published products" on baskets
  for select using (exists (select 1 from products p where p.id = product_id and p.status = 'published'));

-- ───────────── Extra stock helpers ─────────────
-- take_stock: used when a customer pays AFTER their 15-minute hold expired (stock was released).
create or replace function take_stock(p_variant uuid, p_qty int) returns boolean
language plpgsql as $$
begin
  update variants set stock = stock - p_qty
   where id = p_variant and stock - reserved >= p_qty;
  return found;
end $$;

-- add_stock: used when she cancels an order that was already counted as sold.
create or replace function add_stock(p_variant uuid, p_qty int) returns void
language sql as $$
  update variants set stock = stock + p_qty where id = p_variant;
$$;

-- ───────────── SECURITY: lock the stock functions down ─────────────
-- Supabase exposes database functions through its public API, and the anon key is public.
-- Without this, anyone could call reserve_stock / add_stock and tamper with your inventory.
revoke execute on function reserve_stock(uuid, int), release_stock(uuid, int), commit_stock(uuid, int),
                           take_stock(uuid, int), add_stock(uuid, int)
  from public, anon, authenticated;
grant execute on function reserve_stock(uuid, int), release_stock(uuid, int), commit_stock(uuid, int),
                          take_stock(uuid, int), add_stock(uuid, int)
  to service_role;

-- ───────────── Product photo storage ─────────────
-- Public bucket (photos are shown on the shop). Uploads happen only from the server.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- ───────────── Extra stock helpers ─────────────
-- take_stock: used only when a payment lands after the 15-minute hold expired.
create or replace function take_stock(p_variant uuid, p_qty int) returns boolean
language plpgsql as $$
begin
  update variants set stock = stock - p_qty
   where id = p_variant and stock - reserved >= p_qty;
  return found;
end $$;

-- add_stock: puts stock back when an order is cancelled after it was committed.
create or replace function add_stock(p_variant uuid, p_qty int) returns void
language sql as $$
  update variants set stock = stock + p_qty where id = p_variant;
$$;

-- SECURITY: Supabase exposes database functions over its public API, and the anon key is public.
-- Only the server (service_role) may call the stock functions, or anyone could lock or edit stock.
revoke execute on function reserve_stock(uuid, int), release_stock(uuid, int), commit_stock(uuid, int),
                           take_stock(uuid, int), add_stock(uuid, int)
  from public, anon, authenticated;
grant execute on function reserve_stock(uuid, int), release_stock(uuid, int), commit_stock(uuid, int),
                          take_stock(uuid, int), add_stock(uuid, int)
  to service_role;

-- ───────────── Product photo storage ─────────────
-- Public bucket (anyone can view photos). Uploads happen only through the server.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;
