import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const db = createAdminClient();
  const { data: products, error } = await db.from("products").select("slug,updated_at").eq("available", true).eq("archived", false);
  if (error) throw new Error("Unable to generate store sitemap.");
  const paths = ["/", "/shop", "/about", "/contact", "/privacy", "/terms", "/refunds", "/shipping"];
  return [
    ...paths.map(path => ({ url: `${site}${path}`, lastModified: new Date() })),
    ...products.map(product => ({ url: `${site}/product/${product.slug}`, lastModified: new Date(product.updated_at) })),
  ];
}
