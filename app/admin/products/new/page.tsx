import { createAdminClient } from "@/lib/supabase/admin";
import { AdminProductForm } from "@/components/admin-product-form";
import { requireAdminPage } from "@/lib/admin-auth";
export const dynamic = "force-dynamic";
export default async function NewProductPage() {
  await requireAdminPage();
  const { data, error } = await createAdminClient().from("categories").select("*").order("name");
  if (error) throw new Error(`Unable to load categories: ${error.message}`);
  return <><span className="eyebrow">Grow your gift collection</span><h1 style={{ fontSize: 36 }}>Add a product</h1><AdminProductForm categories={data ?? []} /></>;
}
