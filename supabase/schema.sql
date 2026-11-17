create extension if not exists pgcrypto;
create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.box_colours (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.box_colours (name, sort_order) values
  ('Blush pink', 10),
  ('Lavender', 20),
  ('Cream', 30)
on conflict (name) do nothing;
insert into public.categories (name, slug, description) values
  ('Girls Collection', 'girls', 'Thoughtful little gifts for the girls.'),
  ('Boys Collection', 'boys', 'Fun surprises, thoughtfully picked.'),
  ('Pink Princess Box', 'pink-princess-box', 'A little pink, a lot of magic.'),
  ('Study Girl Box', 'study-girl-box', 'A sweet pick-me-up for study days.'),
  ('Self Care Box', 'self-care-box', 'A reminder to take a little time for you.'),
  ('Bestie Forever Box', 'bestie-forever-box', 'For the best friend who deserves the world.')
on conflict (slug) do nothing;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sku text not null unique,
  description text not null default '',
  category_id uuid references public.categories(id) on delete set null,
  price numeric(10,2) not null check (price >= 0),
  compare_at_price numeric(10,2) check (compare_at_price is null or compare_at_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  features text[] not null default '{}',
  hamper_items text[] not null default '{}',
  size text,
  weight_grams integer check (weight_grams is null or weight_grams >= 0),
  available boolean not null default true,
  featured boolean not null default false,
  new_arrival boolean not null default false,
  customizable boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_listing_idx on public.products(available, archived, featured);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  created_at timestamptz not null default now()
);
alter table public.customers add column if not exists email text;

create or replace function public.create_customer_profile()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into public.customers (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
revoke all on function public.create_customer_profile() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_customer on auth.users;
create trigger on_auth_user_created_customer
after insert on auth.users
for each row execute function public.create_customer_profile();

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id),
  order_number text not null unique,
  subtotal numeric(10,2) not null check (subtotal >= 0),
  shipping_charge numeric(10,2) not null default 0 check (shipping_charge >= 0),
  discount numeric(10,2) not null default 0 check (discount >= 0),
  total numeric(10,2) not null check (total >= 0),
  currency text not null default 'INR',
  order_status text not null default 'Pending' check (order_status in ('Pending','Paid','Processing','Packed','Shipped','Delivered','Cancelled')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),
  payment_method text not null default 'cashfree' check (payment_method in ('cashfree','manual_upi')),
  payment_reference_code text,
  payment_reference text,
  payment_claim_reference text,
  payment_verified_at timestamptz,
  payment_verified_by uuid references auth.users(id),
  payment_details jsonb,
  cashfree_order_id text unique,
  tracking_number text,
  shipping_address jsonb not null default '{}',
  coupon_code text,
  custom_details jsonb,
  stock_reserved boolean not null default false,
  reservation_expires_at timestamptz,
  reservation_expired boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_customer_idx on public.orders(customer_id, created_at desc);
create index if not exists orders_status_idx on public.orders(order_status);
create index if not exists orders_reservation_expiry_idx on public.orders(reservation_expires_at) where stock_reserved and payment_status = 'pending';
create unique index if not exists orders_payment_claim_reference_unique on public.orders(payment_claim_reference) where payment_claim_reference is not null;
create unique index if not exists orders_manual_payment_reference_unique on public.orders(payment_reference) where payment_method = 'manual_upi' and payment_reference is not null;
create unique index if not exists orders_payment_reference_code_unique on public.orders(payment_reference_code) where payment_reference_code is not null;

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  sku text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.custom_enquiries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  recipient_name text not null,
  occasion text not null,
  box_colour text not null,
  personal_message text,
  special_instructions text,
  selected_items jsonb not null default '[]',
  estimated_total numeric(10,2) not null default 0,
  status text not null default 'New',
  created_at timestamptz not null default now()
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percent','fixed')),
  discount_value numeric(10,2) not null check (discount_value > 0),
  minimum_order numeric(10,2) not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.store_settings (
  id integer primary key default 1 check (id = 1),
  brand_name text not null default 'LILSURPRIZ',
  logo_url text,
  business_phone text not null default '9585664547',
  business_address text not null default '41/A Rajiv Gandhi street, Pallikaranai, Chennai',
  whatsapp_number text not null default '9585664547',
  contact_email text not null default 'lilsurpriz@gmail.com',
  instagram_url text not null default '',
  shipping_charge numeric(10,2) not null default 60,
  free_shipping_threshold numeric(10,2) not null default 999,
  upi_id text not null default '',
  upi_qr_url text,
  announcement text not null default 'Little gifts, big surprises.',
  social_links jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
insert into public.store_settings (id) values (1) on conflict (id) do nothing;

create or replace function public.is_admin()
returns boolean language sql stable security invoker
as $$ select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin' $$;

alter table public.categories enable row level security;
alter table public.box_colours enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.custom_enquiries enable row level security;
alter table public.coupons enable row level security;
alter table public.store_settings enable row level security;

create policy "Public can view active categories" on public.categories for select using (active or public.is_admin());
create policy "Admins manage categories" on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy "Public can view active box colours" on public.box_colours for select using (active or public.is_admin());
create policy "Admins manage box colours" on public.box_colours for all using (public.is_admin()) with check (public.is_admin());
create policy "Public can view active products" on public.products for select using ((available and not archived) or public.is_admin());
create policy "Admins manage products" on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy "Public can view product images" on public.product_images for select using (
  public.is_admin() or exists (select 1 from public.products p where p.id = product_id and p.available and not p.archived)
);
create policy "Admins manage product images" on public.product_images for all using (public.is_admin()) with check (public.is_admin());
create policy "Customers view own profile" on public.customers for select using (id = auth.uid() or public.is_admin());
create policy "Customers update own profile" on public.customers for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy "Customers view own orders" on public.orders for select using (customer_id = auth.uid() or public.is_admin());
create policy "Admins manage orders" on public.orders for all using (public.is_admin()) with check (public.is_admin());
create policy "Customers view own order lines" on public.order_items for select using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
);
create policy "Admins manage order lines" on public.order_items for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage enquiries" on public.custom_enquiries for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage coupons" on public.coupons for all using (public.is_admin()) with check (public.is_admin());
create policy "Public can read store settings" on public.store_settings for select using (true);
create policy "Admins manage store settings" on public.store_settings for all using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 10485760, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = true, file_size_limit = 10485760, allowed_mime_types = excluded.allowed_mime_types;
create policy "Public can read product image objects" on storage.objects for select using (bucket_id = 'product-images');
create policy "Admins upload product images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin());
create policy "Admins update product images" on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.is_admin()) with check (bucket_id = 'product-images' and public.is_admin());
create policy "Admins delete product images" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.is_admin());

create or replace function public.mark_order_paid(p_order_id uuid, p_reference text)
returns void language plpgsql security definer set search_path = public
as $$
declare existing_status text;
begin
  select payment_status into existing_status from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if existing_status = 'paid' then return; end if;
  if exists (
    select 1 from public.order_items oi join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id and p.stock < oi.quantity
  ) then raise exception 'Insufficient stock to fulfil order'; end if;
  update public.products p set stock = p.stock - oi.quantity, updated_at = now()
    from public.order_items oi where oi.order_id = p_order_id and oi.product_id = p.id;
  update public.orders set payment_status = 'paid', order_status = 'Paid', payment_reference = p_reference, updated_at = now()
    where id = p_order_id;
end;
$$;
revoke all on function public.mark_order_paid(uuid, text) from public, anon, authenticated;
grant execute on function public.mark_order_paid(uuid, text) to service_role;

create or replace function public.expire_pending_order_reservations()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_item record;
  v_expired_count integer := 0;
begin
  for v_order_id in
    select id
    from public.orders
    where payment_method = 'manual_upi'
      and payment_status = 'pending'
      and order_status = 'Pending'
      and stock_reserved
      and reservation_expires_at <= now()
    order by reservation_expires_at, id
    for update skip locked
  loop
    for v_item in
      select product_id, quantity
      from public.order_items
      where order_id = v_order_id and product_id is not null
      order by product_id
    loop
      update public.products
      set stock = stock + v_item.quantity, updated_at = now()
      where id = v_item.product_id;
    end loop;

    update public.orders
    set stock_reserved = false,
        reservation_expires_at = null,
        reservation_expired = true,
        order_status = 'Cancelled',
        payment_status = 'failed',
        updated_at = now()
    where id = v_order_id;
    v_expired_count := v_expired_count + 1;
  end loop;

  return v_expired_count;
end;
$$;
revoke all on function public.expire_pending_order_reservations() from public, anon, authenticated;
grant execute on function public.expire_pending_order_reservations() to service_role;

create or replace function public.create_manual_upi_order(
  p_customer_id uuid,
  p_order_number text,
  p_subtotal numeric,
  p_shipping_charge numeric,
  p_discount numeric,
  p_total numeric,
  p_coupon_code text,
  p_payment_details jsonb,
  p_shipping_address jsonb,
  p_custom_details jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_item record;
  v_product record;
begin
  if nullif(p_payment_details ->> 'payment_reference_code', '') is null then
    raise exception using errcode = 'P0001', message = 'PAYMENT_REFERENCE_REQUIRED';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception using errcode = 'P0001', message = 'INVALID_ORDER_ITEMS';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_ORDER_ITEMS';
  end if;
  if p_subtotal <= 0 or p_shipping_charge < 0 or p_discount < 0 or p_total < 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_ORDER_TOTAL';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer, unit_price numeric)
    where product_id is null or quantity is null or quantity not between 1 and 25 or unit_price is null or unit_price < 0
  ) or (
    select count(*) <> count(distinct product_id)
    from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer, unit_price numeric)
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_ORDER_ITEMS';
  end if;
  if p_discount > p_subtotal
    or p_subtotal <> (
      select coalesce(sum(unit_price * quantity), 0)
      from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer, unit_price numeric)
    )
    or p_total <> round(p_subtotal - p_discount + p_shipping_charge, 2) then
    raise exception using errcode = 'P0001', message = 'INVALID_ORDER_TOTAL';
  end if;

  perform public.expire_pending_order_reservations();

  for v_item in
    select product_id, quantity, unit_price
    from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer, unit_price numeric)
    order by product_id
  loop
    select name, sku, price, stock, available, archived
    into v_product
    from public.products
    where id = v_item.product_id
    for update;

    if not found or not v_product.available or v_product.archived then
      raise exception using errcode = 'P0001', message = 'PRODUCT_UNAVAILABLE';
    end if;
    if v_product.price <> v_item.unit_price then
      raise exception using errcode = 'P0001', message = 'PRICE_CHANGED';
    end if;
    if v_product.stock < v_item.quantity then
      raise exception using errcode = 'P0001', message = 'INSUFFICIENT_STOCK',
        detail = format('%s has only %s left.', v_product.name, v_product.stock);
    end if;

    update public.products
    set stock = stock - v_item.quantity, updated_at = now()
    where id = v_item.product_id;
  end loop;

  insert into public.orders (
    customer_id, order_number, subtotal, shipping_charge, discount, total,
    coupon_code, payment_method, payment_status, payment_reference_code, payment_details,
    shipping_address, custom_details, stock_reserved, reservation_expires_at
  )
  values (
    p_customer_id, p_order_number, p_subtotal, p_shipping_charge, p_discount, p_total,
    p_coupon_code, 'manual_upi', 'pending', nullif(p_payment_details ->> 'payment_reference_code', ''), p_payment_details,
    p_shipping_address, p_custom_details, true, now() + interval '30 minutes'
  )
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, product_name, sku, quantity, unit_price)
  select v_order_id, product.id, product.name, product.sku, item.quantity, product.price
  from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer, unit_price numeric)
  join public.products product on product.id = item.product_id;

  return v_order_id;
end;
$$;
revoke all on function public.create_manual_upi_order(uuid, text, numeric, numeric, numeric, numeric, text, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_manual_upi_order(uuid, text, numeric, numeric, numeric, numeric, text, jsonb, jsonb, jsonb, jsonb) to service_role;

create or replace function public.complete_manual_upi_payment(p_order_id uuid, p_reference text, p_verified_by uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  if p_verified_by is null or nullif(trim(p_reference), '') is null then
    raise exception using errcode = 'P0001', message = 'VERIFICATION_DETAILS_REQUIRED';
  end if;

  perform public.expire_pending_order_reservations();

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.payment_status = 'paid' then
    return true;
  end if;
  if v_order.payment_method <> 'manual_upi'
    or v_order.payment_status not in ('pending', 'failed')
    or (v_order.order_status = 'Cancelled' and not v_order.reservation_expired) then
    return false;
  end if;
  if exists (
    select 1
    from public.order_items
    where order_id = p_order_id and product_id is null
  ) then
    return false;
  end if;

  if v_order.stock_reserved and v_order.reservation_expires_at <= now() then
    for v_item in
      select product_id, quantity
      from public.order_items
      where order_id = p_order_id and product_id is not null
      order by product_id
    loop
      update public.products
      set stock = stock + v_item.quantity, updated_at = now()
      where id = v_item.product_id;
    end loop;

    update public.orders
    set order_status = 'Cancelled',
        payment_status = 'failed',
        stock_reserved = false,
        reservation_expires_at = null,
        reservation_expired = true,
        updated_at = now()
    where id = p_order_id;
    v_order.stock_reserved := false;
    v_order.reservation_expired := true;
  end if;

  if not v_order.stock_reserved then
    for v_item in
      select product.id, product.stock, order_item.quantity
      from public.order_items order_item
      join public.products product on product.id = order_item.product_id
      where order_item.order_id = p_order_id
      order by product.id
      for update of product
    loop
      if v_item.stock < v_item.quantity then
        return false;
      end if;
    end loop;

    for v_item in
      select product.id, order_item.quantity
      from public.order_items order_item
      join public.products product on product.id = order_item.product_id
      where order_item.order_id = p_order_id
      order by product.id
    loop
      update public.products
      set stock = stock - v_item.quantity, updated_at = now()
      where id = v_item.id;
    end loop;
  end if;

  update public.orders
  set payment_status = 'paid',
      order_status = 'Paid',
      payment_reference = trim(p_reference),
      payment_verified_at = now(),
      payment_verified_by = p_verified_by,
      stock_reserved = false,
      reservation_expires_at = null,
      reservation_expired = false,
      updated_at = now()
  where id = p_order_id;

  return true;
end;
$$;
revoke all on function public.complete_manual_upi_payment(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.complete_manual_upi_payment(uuid, text, uuid) to service_role;

create or replace function public.cancel_order_and_release_stock(p_order_id uuid, p_tracking_number text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.stock_reserved then
    for v_item in
      select product_id, quantity
      from public.order_items
      where order_id = p_order_id and product_id is not null
      order by product_id
    loop
      update public.products
      set stock = stock + v_item.quantity, updated_at = now()
      where id = v_item.product_id;
    end loop;
  end if;

  update public.orders
  set order_status = 'Cancelled',
      payment_status = case when payment_status = 'pending' then 'failed' else payment_status end,
      stock_reserved = false,
      reservation_expires_at = null,
      reservation_expired = case when stock_reserved then false else reservation_expired end,
      tracking_number = p_tracking_number,
      updated_at = now()
  where id = p_order_id;
end;
$$;
revoke all on function public.cancel_order_and_release_stock(uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_order_and_release_stock(uuid, text) to service_role;

create or replace function public.prevent_delete_reserved_product()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.order_items item
    join public.orders order_record on order_record.id = item.order_id
    where item.product_id = old.id and order_record.stock_reserved
  ) then
    raise exception using errcode = 'P0001', message = 'PRODUCT_HAS_ACTIVE_STOCK_RESERVATION';
  end if;
  return old;
end;
$$;
revoke all on function public.prevent_delete_reserved_product() from public, anon, authenticated;
drop trigger if exists products_prevent_reserved_delete on public.products;
create trigger products_prevent_reserved_delete
before delete on public.products
for each row execute function public.prevent_delete_reserved_product();

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'lilsurpriz-expire-upi-reservations';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
  perform cron.schedule(
    'lilsurpriz-expire-upi-reservations',
    '* * * * *',
    'select public.expire_pending_order_reservations();'
  );
end;
$$;
