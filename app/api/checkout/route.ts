import { z } from "zod";
import { createGuestOrderAccessToken } from "@/lib/guest-order-access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";

const photoBucket = "customer-order-photos";
const maxPhotos = 10;
const maxPhotoBytes = 350_000;
const photoTypes: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const requestSchema = z.object({
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(25) })).min(1).max(30)
    .refine(items => new Set(items.map(item => item.productId)).size === items.length, "Duplicate products are not allowed."),
  name: z.string().trim().min(2).max(100),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
  address: z.string().trim().min(8).max(300),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z.string().regex(/^\d{6}$/),
  coupon: z.string().trim().max(40).optional(),
});

async function removeCustomerPhotos(admin: ReturnType<typeof createAdminClient>, paths: string[]) {
  if (!paths.length) return;
  const { error } = await admin.storage.from(photoBucket).remove(paths);
  if (error) console.error("Unable to clean up customer photo uploads", error.message);
}

function messageText(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  if (!formData) return Response.json({ error: "Please submit the order form again." }, { status: 400 });
  const orderData = formData.get("order");
  if (typeof orderData !== "string") return Response.json({ error: "Order details are missing." }, { status: 400 });

  let rawOrder: unknown;
  try {
    rawOrder = JSON.parse(orderData);
  } catch {
    return Response.json({ error: "Order details could not be read." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(rawOrder);
  if (!parsed.success) return Response.json({ error: "Please check your delivery details and selected items." }, { status: 400 });

  const photosByProduct = new Map<string, File[]>();
  let photoCount = 0;
  let photoBytes = 0;
  for (const [field, entry] of formData.entries()) {
    if (field === "order") continue;
    const match = /^photos:([0-9a-f-]{36})$/i.exec(field);
    if (!match || typeof entry === "string") {
      return Response.json({ error: "Invalid product photo upload." }, { status: 400 });
    }
    const photos = photosByProduct.get(match[1]) ?? [];
    photos.push(entry);
    photosByProduct.set(match[1], photos);
    photoCount += 1;
    photoBytes += entry.size;
    if (photoCount > maxPhotos) return Response.json({ error: `Choose up to ${maxPhotos} photos across your order.` }, { status: 400 });
    if (!photoTypes[entry.type] || entry.size <= 0 || entry.size > maxPhotoBytes) {
      return Response.json({ error: "Each photo must be a JPG, PNG, or WebP under 350 KB after resizing." }, { status: 400 });
    }
  }
  if (photoBytes > maxPhotos * maxPhotoBytes) {
    return Response.json({ error: "The selected photos are too large. Please remove a photo and try again." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();
  const requested = parsed.data.items;
  const productIds = [...new Set(requested.map(item => item.productId))];
  const { data: products, error: productError } = await admin.from("products")
    .select("id,name,sku,price,stock,available,archived,customer_photo_mode,customer_photo_limit").in("id", productIds);
  if (productError) return Response.json({ error: "Unable to verify product availability." }, { status: 500 });
  const productMap = new Map((products ?? []).map(product => [product.id, product]));
  const requestedProductIds = new Set(requested.map(item => item.productId));
  if ([...photosByProduct.keys()].some(productId => !requestedProductIds.has(productId))) {
    return Response.json({ error: "Photos were submitted for an item that is not in this order." }, { status: 400 });
  }
  const orderLines = [];
  let subtotal = 0;
  for (const item of requested) {
    const product = productMap.get(item.productId);
    if (!product || !product.available || product.archived) return Response.json({ error: "One of your selected gifts is no longer available." }, { status: 409 });
    if (product.stock < item.quantity) return Response.json({ error: `${product.name} has only ${product.stock} left.` }, { status: 409 });
    const productPhotoCount = photosByProduct.get(product.id)?.length ?? 0;
    if (product.customer_photo_mode === "none" && productPhotoCount > 0) {
      return Response.json({ error: `${product.name} does not accept customer photos.` }, { status: 400 });
    }
    if (product.customer_photo_mode === "required" && productPhotoCount === 0) {
      return Response.json({ error: `Add at least one photo for ${product.name}.` }, { status: 400 });
    }
    if (productPhotoCount > product.customer_photo_limit) {
      return Response.json({ error: `Choose up to ${product.customer_photo_limit} photos for ${product.name}.` }, { status: 400 });
    }
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

  const { data: settings, error: settingsError } = await admin.from("store_settings")
    .select("shipping_charge,free_shipping_threshold,whatsapp_number").eq("id", 1).maybeSingle();
  if (settingsError) return Response.json({ error: "Unable to load delivery and WhatsApp settings." }, { status: 500 });
  const whatsappNumber = normalizeWhatsAppNumber(String(settings?.whatsapp_number || process.env.WHATSAPP_NUMBER || "9585664547"));
  if (!whatsappNumber) return Response.json({ error: "WhatsApp orders are not available right now. Please contact the store." }, { status: 503 });

  const shipping = subtotal - discount >= Number(settings?.free_shipping_threshold ?? 999) ? 0 : Number(settings?.shipping_charge ?? 60);
  const total = Math.round((subtotal - discount + shipping) * 100) / 100;
  if (user) {
    const { error: customerError } = await admin.from("customers").upsert({ id: user.id, full_name: parsed.data.name, email: (user.email ?? parsed.data.email) || null, phone: parsed.data.phone });
    if (customerError) return Response.json({ error: "Unable to save customer details." }, { status: 500 });
  }

  const orderNumber = `LS-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
  const guestAccess = user ? null : createGuestOrderAccessToken();
  const uploadedPaths: string[] = [];
  const uploadedPathsByProduct = new Map<string, string[]>();
  for (const line of orderLines) {
    const photos = photosByProduct.get(line.product_id) ?? [];
    for (const photo of photos) {
      const extension = photoTypes[photo.type];
      const path = `orders/${orderNumber}/${line.product_id}/${crypto.randomUUID()}.${extension}`;
      const { error } = await admin.storage.from(photoBucket).upload(path, await photo.arrayBuffer(), {
        contentType: photo.type,
        cacheControl: "3600",
        upsert: false,
      });
      if (error) {
        await removeCustomerPhotos(admin, uploadedPaths);
        console.error("Unable to upload customer order photo", error.message);
        const storageError = error.message.toLowerCase();
        const uploadMessage = /row-level security|permission denied|unauthorized|forbidden|invalid jwt|invalid api key/.test(storageError)
          ? "Photo upload permissions are not configured on the store server. Please contact the store."
          : /bucket.*not found|not found.*bucket/.test(storageError)
            ? "Photo storage is not configured for this website yet. Please contact the store."
            : "Unable to save your photos. Please try again or contact the store.";
        return Response.json({ error: uploadMessage }, { status: 503 });
      }
      uploadedPaths.push(path);
      uploadedPathsByProduct.set(line.product_id, [...(uploadedPathsByProduct.get(line.product_id) ?? []), path]);
    }
  }

  const signedPhotosByProduct = new Map<string, string[]>();
  for (const line of orderLines) {
    const paths = uploadedPathsByProduct.get(line.product_id) ?? [];
    const signedUrls: string[] = [];
    for (const path of paths) {
      const { data, error } = await admin.storage.from(photoBucket).createSignedUrl(path, 60 * 60 * 24 * 7);
      if (error || !data?.signedUrl) {
        await removeCustomerPhotos(admin, uploadedPaths);
        console.error("Unable to create secure link for customer order photo", error?.message ?? "Missing signed URL.");
        return Response.json({ error: "Unable to prepare your photos for WhatsApp. Please try again." }, { status: 503 });
      }
      signedUrls.push(data.signedUrl);
    }
    if (signedUrls.length) signedPhotosByProduct.set(line.product_id, signedUrls);
  }
  const customerPhotoGroups = orderLines.flatMap(line => {
    const paths = uploadedPathsByProduct.get(line.product_id) ?? [];
    return paths.length ? [{ product_id: line.product_id, product_name: line.product_name, paths }] : [];
  });

  const { data: orderId, error: orderError } = await admin.rpc("create_manual_upi_order", {
    p_customer_id: user?.id ?? null,
    p_order_number: orderNumber,
    p_subtotal: subtotal,
    p_shipping_charge: shipping,
    p_discount: discount,
    p_total: total,
    p_coupon_code: couponCode,
    p_payment_details: {
      payment_flow: "whatsapp",
      customer_photo_paths: uploadedPaths,
      customer_photo_groups: customerPhotoGroups,
      ...(guestAccess ? { guest_access_token_hash: guestAccess.tokenHash } : {}),
    },
    p_shipping_address: { name: parsed.data.name, phone: parsed.data.phone, email: parsed.data.email || null, address: parsed.data.address, city: parsed.data.city, state: parsed.data.state, pincode: parsed.data.pincode },
    p_custom_details: null,
    p_items: orderLines.map(line => ({ product_id: line.product_id, quantity: line.quantity, unit_price: line.unit_price })),
  });
  if (orderError || !orderId) {
    await removeCustomerPhotos(admin, uploadedPaths);
    if (orderError?.message === "INSUFFICIENT_STOCK") {
      return Response.json({ error: orderError.details ?? "One of your selected gifts just sold out." }, { status: 409 });
    }
    if (orderError?.message === "PRICE_CHANGED") {
      return Response.json({ error: "A product price changed. Please refresh your bag and try again." }, { status: 409 });
    }
    if (orderError?.message === "PRODUCT_UNAVAILABLE") {
      return Response.json({ error: "One of your selected gifts is no longer available." }, { status: 409 });
    }
    if (orderError?.message === "PAYMENT_REFERENCE_REQUIRED") {
      console.error("WhatsApp checkout database migration is missing", orderNumber);
      return Response.json({ error: "WhatsApp checkout needs a database update. Please contact the store." }, { status: 503 });
    }
    console.error("Unable to create WhatsApp order request", orderError?.message);
    return Response.json({ error: "Unable to save your order request. Please try again." }, { status: 500 });
  }

  const itemSummary = orderLines.map(line => `${line.quantity} × ${messageText(line.product_name)} (₹${(line.unit_price * line.quantity).toLocaleString("en-IN")})`).join("\n");
  const address = [parsed.data.address, parsed.data.city, parsed.data.state, parsed.data.pincode].map(messageText).join(", ");
  const customerPhotoMessages = orderLines.flatMap(line => {
    const urls = signedPhotosByProduct.get(line.product_id) ?? [];
    return urls.length ? [`Customer photos for ${messageText(line.product_name)}:\n${urls.join("\n")}`] : [];
  });
  const orderMessageLines = [
    `Hi LILSURPRIZ, I'd like to place order request ${orderNumber}.`,
    `Name: ${messageText(parsed.data.name)}`,
    `Phone: ${parsed.data.phone}`,
    ...(parsed.data.email ? [`Email: ${messageText(parsed.data.email)}`] : []),
    `Delivery address: ${address}`,
    `Items:\n${itemSummary}`,
    `Subtotal: ₹${subtotal.toLocaleString("en-IN")}`,
    `Delivery: ${shipping ? `₹${shipping.toLocaleString("en-IN")}` : "Free"}`,
    ...(discount ? [`Discount${couponCode ? ` (${couponCode})` : ""}: ₹${discount.toLocaleString("en-IN")}`] : []),
    `Estimated total: ₹${total.toLocaleString("en-IN")}`,
    ...customerPhotoMessages,
    "Please confirm availability and share payment instructions. Items are held for 30 minutes. I have not paid yet.",
  ];
  const message = orderMessageLines.join("\n");
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  return Response.json({
    orderId,
    orderNumber,
    whatsappUrl,
    ...(guestAccess ? { accessToken: guestAccess.token } : {}),
  }, { headers: { "Cache-Control": "no-store" } });
}
