import { createAdminClient } from "@/lib/supabase/admin";
import { AdminCategoryManager } from "@/components/admin-category-manager";
import type { Category } from "@/lib/types";
import { requireAdminPage } from "@/lib/admin-auth";
export const dynamic = "force-dynamic";
export default async function AdminCategoriesPage() {
  await requireAdminPage();
  const { data, error } = await createAdminClient().from("categories").select("*").order("name");
  if (error) throw new Error(`Unable to load categories: ${error.message}`);
  return <><span className="eyebrow">Organise your gifts</span><h1 style={{ fontSize: 38 }}>Categories</h1><AdminCategoryManager categories={(data ?? []) as Category[]} /></>;
}
