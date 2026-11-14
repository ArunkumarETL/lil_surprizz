import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminProductForm } from "@/components/admin-product-form";
import type { Category, Product } from "@/lib/types";
import { requireAdminPage } from "@/lib/admin-auth";
export const dynamic = "force-dynamic";
export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const db = createAdminClient();
  const [productResult, categoryResult] = await Promise.all([db.from("products").select("*, product_images(*)").eq("id", id).maybeSingle(), db.from("categories").select("*").order("name")]);
  if (productResult.error || categoryResult.error) throw new Error("Unable to load product editor.");
  if (!productResult.data) notFound();
  return <><span className="eyebrow">Update your catalogue</span><h1 style={{ fontSize: 36 }}>Edit product</h1><AdminProductForm product={productResult.data as Product} categories={(categoryResult.data ?? []) as Category[]} /></>;
}
