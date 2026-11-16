create extension if not exists pg_cron with schema pg_catalog;

alter table public.orders
  add column if not exists stock_reserved boolean not null default false,
  add column if not exists reservation_expires_at timestamptz,
  add column if not exists reservation_expired boolean not null default false;

create index if not exists orders_reservation_expiry_idx
  on public.orders (reservation_expires_at)
  where stock_reserved and payment_status = 'pending';

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
    coupon_code, payment_method, payment_details, shipping_address, custom_details,
    stock_reserved, reservation_expires_at
  )
  values (
    p_customer_id, p_order_number, p_subtotal, p_shipping_charge, p_discount, p_total,
    p_coupon_code, 'manual_upi', p_payment_details, p_shipping_address, p_custom_details,
    true, now() + interval '30 minutes'
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

create or replace function public.complete_manual_upi_payment(p_order_id uuid, p_reference text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
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
      payment_reference = p_reference,
      stock_reserved = false,
      reservation_expires_at = null,
      reservation_expired = false,
      updated_at = now()
  where id = p_order_id;

  return true;
end;
$$;
revoke all on function public.complete_manual_upi_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.complete_manual_upi_payment(uuid, text) to service_role;

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
