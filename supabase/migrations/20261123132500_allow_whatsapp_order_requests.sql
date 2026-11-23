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
  if coalesce(p_payment_details ->> 'payment_flow', '') <> 'whatsapp'
    and nullif(p_payment_details ->> 'payment_reference_code', '') is null then
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

notify pgrst, 'reload schema';
