create extension if not exists pgcrypto;

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
  payment_reference text,
  payment_claim_reference text,
  payment_details jsonb,
  cashfree_order_id text unique,
  tracking_number text,
  shipping_address jsonb not null default '{}',
  coupon_code text,
  custom_details jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_customer_idx on public.orders(customer_id, created_at desc);
create index if not exists orders_status_idx on public.orders(order_status);
create unique index if not exists orders_payment_claim_reference_unique on public.orders(payment_claim_reference) where payment_claim_reference is not null;
create unique index if not exists orders_manual_payment_reference_unique on public.orders(payment_reference) where payment_method = 'manual_upi' and payment_reference is not null;

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
