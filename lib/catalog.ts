import { createClient } from "@/lib/supabase/server";
import type { Product, StoreSettings } from "@/lib/types";

export async function getProducts(options: { category?: string; featured?: boolean; limit?: number } = {}) {
  const supabase = await createClient();
  let categoryId: string | null = null;
  if (options.category) {
    const { data: category, error: categoryError } = await supabase.from("categories").select("id").eq("slug", options.category).maybeSingle();
    if (categoryError) throw new Error(`Unable to load category: ${categoryError.message}`);
    categoryId = category?.id ?? null;
    if (!categoryId) return [];
  }
  let query = supabase.from("products").select("*, category:categories(*), product_images(*)")
    .eq("available", true).eq("archived", false).order("created_at", { ascending: false });
  if (categoryId) query = query.eq("category_id", categoryId);
  if (options.featured) query = query.eq("featured", true);
  if (options.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) throw new Error(`Unable to load products: ${error.message}`);
  return (data ?? []) as Product[];
}

export async function getProduct(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select("*, category:categories(*), product_images(*)")
    .eq("slug", slug).eq("available", true).eq("archived", false).maybeSingle();
  if (error) throw new Error(`Unable to load product: ${error.message}`);
  return data as Product | null;
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("store_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(`Unable to load store settings: ${error.message}`);
  return {
    brand_name: data?.brand_name ?? "LILSURPRIZ",
    logo_url: data?.logo_url ?? null,
    business_phone: data?.business_phone ?? "9585664547",
    business_address: data?.business_address ?? "41/A Rajiv Gandhi street, Pallikaranai, Chennai",
    whatsapp_number: data?.whatsapp_number ?? process.env.WHATSAPP_NUMBER ?? "9585664547",
    contact_email: data?.contact_email ?? "lilsurpriz@gmail.com",
    instagram_url: data?.instagram_url ?? "",
    shipping_charge: Number(data?.shipping_charge ?? 60),
    free_shipping_threshold: Number(data?.free_shipping_threshold ?? 999),
    upi_id: data?.upi_id ?? "",
    upi_qr_url: data?.upi_qr_url ?? null,
    announcement: data?.announcement ?? "Little gifts, big surprises.",
    social_links: data?.social_links ?? {},
  };
}
