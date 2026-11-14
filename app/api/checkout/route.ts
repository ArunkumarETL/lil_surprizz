import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const requestSchema = z.object({
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(25) })).min(1).max(30)
    .refine(items => new Set(items.map(item => item.productId)).size === items.length, "Duplicate products are not allowed."),
  name: z.string().trim().min(2).max(100),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  address: z.string().trim().min(8).max(300),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z.string().regex(/^\d{6}$/),
  coupon: z.string().trim().max(40).optional(),
  customization: z.record(z.string(), z.unknown()).optional(),
});

function cashfreeBase() {
  return process.env.CASHFREE_ENV === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please check your delivery details and items." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in before checkout." }, { status: 401 });
  if (!process.env.CASHFREE_CLIENT_ID || !process.env.CASHFREE_CLIENT_SECRET || !process.env.NEXT_PUBLIC_SITE_URL) {
    return Response.json({ error: "Online payment is not configured yet. Please contact the store." }, { status: 503 });
  }
  let siteUrl: URL;
  try { siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL); }
  catch { return Response.json({ error: "The store payment return URL is invalid." }, { status: 503 }); }
  if (process.env.CASHFREE_ENV === "production" && siteUrl.protocol !== "https:") {
    return Response.json({ error: "Production checkout requires a secure HTTPS site URL." }, { status: 503 });
  }

  const admin = createAdminClient();
  const requested = parsed.data.items;
  const productIds = [...new Set(requested.map(item => item.productId))];
  const { data: products, error: productError } = await admin.from("products").select("id,name,sku,price,stock,available,archived").in("id", productIds);
  if (productError) return Response.json({ error: "Unable to verify product availability." }, { status: 500 });
  const productMap = new Map((products ?? []).map(product => [product.id, product]));
  const orderLines = [];
  let subtotal = 0;
  for (const item of requested) {
    const product = productMap.get(item.productId);
    if (!product || !product.available || product.archived) return Response.json({ error: "One of your selected gifts is no longer available." }, { status: 409 });
    if (product.stock < item.quantity) return Response.json({ error: `${product.name} has only ${product.stock} left.` }, { status: 409 });
    const unitPrice = Number(product.price);
    subtotal += unitPrice * item.quantity;
    orderLines.push({ product_id: product.id, product_name: product.name, sku: product.sku, quantity: item.quantity, unit_price: unitPrice });
  }
  if (subtotal <= 0 || !Number.isFinite(subtotal)) return Response.json({ error: "Invalid order total." }, { status: 400 });

  let discount = 0;
  let couponCode: string | null = null;
  if (parsed.data.coupon) {
    const { data: coupon } = await admin.from("coupons").select("*").eq("code", parsed.data.coupon.toUpperCase()).eq("active", true).maybeSingle();
    if (!coupon || (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) || subtotal < Number(coupon.minimum_order)) {
      return Response.json({ error: "That coupon is invalid or does not apply to this order." }, { status: 400 });
    }
    discount = coupon.discount_type === "percent" ? subtotal * Number(coupon.discount_value) / 100 : Number(coupon.discount_value);
    discount = Math.min(subtotal, Math.round(discount * 100) / 100);
    couponCode = coupon.code;
  }
  const { data: settings } = await admin.from("store_settings").select("shipping_charge,free_shipping_threshold").eq("id", 1).maybeSingle();
  const shipping = subtotal - discount >= Number(settings?.free_shipping_threshold ?? 999) ? 0 : Number(settings?.shipping_charge ?? 60);
  const total = Math.round((subtotal - discount + shipping) * 100) / 100;
  const { error: customerError } = await admin.from("customers").upsert({ id: user.id, full_name: parsed.data.name, email: user.email ?? null, phone: parsed.data.phone });
  if (customerError) return Response.json({ error: "Unable to save customer details." }, { status: 500 });

  const orderNumber = `LS-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
  const cashfreeOrderId = `ls_${crypto.randomUUID().replaceAll("-", "").slice(0, 28)}`;
  const { data: order, error: orderError } = await admin.from("orders").insert({
    customer_id: user.id, order_number: orderNumber, subtotal, shipping_charge: shipping, discount, total,
    coupon_code: couponCode, cashfree_order_id: cashfreeOrderId,
    shipping_address: { name: parsed.data.name, phone: parsed.data.phone, address: parsed.data.address, city: parsed.data.city, state: parsed.data.state, pincode: parsed.data.pincode },
    custom_details: parsed.data.customization ?? null,
  }).select("id").single();
  if (orderError || !order) return Response.json({ error: "Unable to create your order." }, { status: 500 });
  const { error: linesError } = await admin.from("order_items").insert(orderLines.map(line => ({ ...line, order_id: order.id })));
  if (linesError) {
    await admin.from("orders").delete().eq("id", order.id);
    return Response.json({ error: "Unable to save your order items." }, { status: 500 });
  }

  const cfResponse = await fetch(`${cashfreeBase()}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-version": process.env.CASHFREE_API_VERSION ?? "2023-08-01",
      "x-client-id": process.env.CASHFREE_CLIENT_ID,
      "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
      "x-idempotency-key": order.id,
    },
    body: JSON.stringify({
      order_id: cashfreeOrderId, order_amount: total, order_currency: "INR",
      customer_details: { customer_id: user.id, customer_name: parsed.data.name, customer_email: user.email, customer_phone: parsed.data.phone },
      order_meta: { return_url: `${siteUrl.origin}/payment/return?order_id=${encodeURIComponent(cashfreeOrderId)}`, notify_url: `${siteUrl.origin}/api/payments/webhook` },
      order_note: `LILSURPRIZ ${orderNumber}`,
    }),
    cache: "no-store",
  });
  const cfData = await cfResponse.json().catch(() => null) as { payment_session_id?: string; order_status?: string; message?: string } | null;
  if (!cfResponse.ok || !cfData?.payment_session_id) {
    await admin.from("orders").update({ order_status: "Cancelled", payment_status: "failed" }).eq("id", order.id);
    console.error("Cashfree order creation failed", cfResponse.status, cfData?.message);
    return Response.json({ error: "Cashfree could not start payment. Please try again." }, { status: 502 });
  }
  const checkoutUrl = process.env.CASHFREE_ENV === "production"
    ? `https://payments.cashfree.com/order/#${cfData.payment_session_id}`
    : `https://payments-test.cashfree.com/order/#${cfData.payment_session_id}`;
  return Response.json({ checkoutUrl, orderNumber });
}
