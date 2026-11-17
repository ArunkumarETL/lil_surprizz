import { z } from "zod";
import { createGuestOrderAccessToken } from "@/lib/guest-order-access";
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
  customization: z.object({
    recipient: z.string().trim().min(1).max(100),
    occasion: z.string().trim().min(1).max(80),
    colour: z.string().trim().min(1).max(60),
    note: z.string().max(500),
    instructions: z.string().max(1000),
  }).optional(),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please check your delivery details and items." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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
  const { data: settings, error: settingsError } = await admin.from("store_settings").select("shipping_charge,free_shipping_threshold,upi_id,upi_qr_url").eq("id", 1).maybeSingle();
  if (settingsError) return Response.json({ error: "Unable to load payment and delivery settings." }, { status: 500 });
  const upiId = String(settings?.upi_id ?? "").trim();
  if (!/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/.test(upiId)) {
    return Response.json({ error: "Manual UPI payment is not configured. Please contact the store." }, { status: 503 });
  }
  const shipping = subtotal - discount >= Number(settings?.free_shipping_threshold ?? 999) ? 0 : Number(settings?.shipping_charge ?? 60);
  const total = Math.round((subtotal - discount + shipping) * 100) / 100;
  if (user) {
    const { error: customerError } = await admin.from("customers").upsert({ id: user.id, full_name: parsed.data.name, email: user.email ?? null, phone: parsed.data.phone });
    if (customerError) return Response.json({ error: "Unable to save customer details." }, { status: 500 });
  }

  const orderNumber = `LS-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
  const paymentReference = `LS${crypto.randomUUID().replace(/-/g, "").toUpperCase()}`;
  const guestAccess = user ? null : createGuestOrderAccessToken();
  const { data: orderId, error: orderError } = await admin.rpc("create_manual_upi_order", {
    p_customer_id: user?.id ?? null,
    p_order_number: orderNumber,
    p_subtotal: subtotal,
    p_shipping_charge: shipping,
    p_discount: discount,
    p_total: total,
    p_coupon_code: couponCode,
    p_payment_details: { upi_id: upiId, qr_url: settings?.upi_qr_url ?? null, payment_reference_code: paymentReference, ...(guestAccess ? { guest_access_token_hash: guestAccess.tokenHash } : {}) },
    p_shipping_address: { name: parsed.data.name, phone: parsed.data.phone, address: parsed.data.address, city: parsed.data.city, state: parsed.data.state, pincode: parsed.data.pincode },
    p_custom_details: parsed.data.customization ?? null,
    p_items: orderLines.map(line => ({ product_id: line.product_id, quantity: line.quantity, unit_price: line.unit_price })),
  });
  if (orderError || !orderId) {
    if (orderError?.message === "INSUFFICIENT_STOCK") {
      return Response.json({ error: orderError.details ?? "One of your selected gifts just sold out." }, { status: 409 });
    }
    if (orderError?.message === "PRICE_CHANGED") {
      return Response.json({ error: "A product price changed. Please refresh your bag and try again." }, { status: 409 });
    }
    if (orderError?.message === "PRODUCT_UNAVAILABLE") {
      return Response.json({ error: "One of your selected gifts is no longer available." }, { status: 409 });
    }
    console.error("Unable to create reserved manual UPI order", orderError?.message);
    return Response.json({ error: "Unable to create your order. Please try again." }, { status: 500 });
  }

  const accessFragment = guestAccess ? `#access_token=${guestAccess.token}` : "";
  return Response.json({ manualPaymentUrl: `/payment/manual?order_id=${encodeURIComponent(orderId)}${accessFragment}`, orderNumber, paymentReference });
}
