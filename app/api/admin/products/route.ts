import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(150),
  sku: z.string().trim().min(1).max(80),
  description: z.string().max(10000),
  category_id: z.string().uuid().nullable(),
  price: z.number().nonnegative().max(10000000),
  compare_at_price: z.number().nonnegative().nullable(),
  stock: z.number().int().nonnegative().max(1000000),
  features: z.array(z.string().max(250)).max(30),
  hamper_items: z.array(z.string().max(250)).max(50),
  size: z.string().max(120).nullable(),
  weight_grams: z.number().int().nonnegative().nullable(),
  available: z.boolean(),
  featured: z.boolean(),
  new_arrival: z.boolean(),
  customizable: z.boolean(),
  image_urls: z.array(z.string().url()).max(12),
});

function slugify(text: string) { return text.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100); }

export async function POST(request: Request) {
  const auth = await requireAdmin(); if ("response" in auth) return auth.response;
  const parsed = productSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please review the product fields and try again." }, { status: 400 });
  const data = parsed.data;
  const db = createAdminClient();
  const { data: product, error } = await db.from("products").insert({
    name: data.name, slug: slugify(data.name), sku: data.sku, description: data.description, category_id: data.category_id,
    price: data.price, compare_at_price: data.compare_at_price, stock: data.stock, features: data.features, hamper_items: data.hamper_items,
    size: data.size, weight_grams: data.weight_grams, available: data.available, featured: data.featured, new_arrival: data.new_arrival, customizable: data.customizable,
  }).select("id").single();
  if (error || !product) return Response.json({ error: error?.code === "23505" ? "Product name or SKU already exists." : "Unable to save product." }, { status: 400 });
  const { error: imageError } = await db.from("product_images").insert(data.image_urls.map((image_url, position) => ({ product_id: product.id, image_url, position, alt_text: data.name })));
  if (imageError) {
    await db.from("products").delete().eq("id", product.id);
    return Response.json({ error: "Product saved but images could not be linked. Please retry." }, { status: 500 });
  }
  return Response.json({ id: product.id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(); if ("response" in auth) return auth.response;
  const parsed = productSchema.extend({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please review the product fields and try again." }, { status: 400 });
  const data = parsed.data;
  const db = createAdminClient();
  const { error } = await db.from("products").update({
    name: data.name, slug: slugify(data.name), sku: data.sku, description: data.description, category_id: data.category_id,
    price: data.price, compare_at_price: data.compare_at_price, stock: data.stock, features: data.features, hamper_items: data.hamper_items,
    size: data.size, weight_grams: data.weight_grams, available: data.available, featured: data.featured, new_arrival: data.new_arrival, customizable: data.customizable, updated_at: new Date().toISOString(),
  }).eq("id", data.id);
  if (error) return Response.json({ error: error.code === "23505" ? "Product name or SKU already exists." : "Unable to update product." }, { status: 400 });
  const { error: removeError } = await db.from("product_images").delete().eq("product_id", data.id);
  if (removeError) return Response.json({ error: "Product saved, but old image references could not be replaced." }, { status: 500 });
  const { error: imageError } = await db.from("product_images").insert(data.image_urls.map((image_url, position) => ({ product_id: data.id, image_url, position, alt_text: data.name })));
  if (imageError) return Response.json({ error: "Product saved, but images could not be linked." }, { status: 500 });
  return Response.json({ id: data.id });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(); if ("response" in auth) return auth.response;
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !z.string().uuid().safeParse(id).success) return Response.json({ error: "Invalid product ID." }, { status: 400 });
  const { error } = await createAdminClient().from("products").update({ archived: true, available: false, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return Response.json({ error: "Unable to archive product." }, { status: 500 });
  return Response.json({ archived: true });
}
