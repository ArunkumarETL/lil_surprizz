import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const db = createAdminClient();
  const [products, categories] = await Promise.all([
    db.from("products").select("slug,updated_at").eq("available", true).eq("archived", false),
    db.from("categories").select("slug").eq("active", true),
  ]);
  if (products.error || categories.error) throw new Error("Unable to generate store sitemap.");
  const paths = ["/", "/shop", "/customise", "/about", "/contact", "/privacy", "/terms", "/refunds", "/shipping"];
  return [
    ...paths.map(path => ({ url: `${site}${path}`, lastModified: new Date() })),
    ...(categories.data ?? []).map(category => ({ url: `${site}/collections/${category.slug}`, lastModified: new Date() })),
    ...(products.data ?? []).map(product => ({ url: `${site}/product/${product.slug}`, lastModified: new Date(product.updated_at) })),
  ];
}
