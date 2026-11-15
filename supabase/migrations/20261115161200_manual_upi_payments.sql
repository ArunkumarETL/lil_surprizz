alter table public.orders
  add column if not exists payment_method text not null default 'cashfree',
  add column if not exists payment_claim_reference text,
  add column if not exists payment_details jsonb;

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders
  add constraint orders_payment_method_check check (payment_method in ('cashfree', 'manual_upi'));

create unique index if not exists orders_payment_claim_reference_unique
  on public.orders(payment_claim_reference)
  where payment_claim_reference is not null;

create unique index if not exists orders_manual_payment_reference_unique
  on public.orders(payment_reference)
  where payment_method = 'manual_upi' and payment_reference is not null;

alter table public.store_settings
  add column if not exists upi_id text not null default '',
  add column if not exists upi_qr_url text;
