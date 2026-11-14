import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { ArchiveButton } from "@/components/archive-button";
import { requireAdminPage } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export default async function AdminProductsPage() {
  await requireAdminPage();
  const { data: products, error } = await createAdminClient().from("products").select("*, category:categories(name), product_images(image_url)").order("created_at", { ascending: false });
  if (error) throw new Error(`Unable to load products: ${error.message}`);
  return <><div className="section-head"><div><span className="eyebrow">Your catalogue</span><h1 style={{ fontSize: 37, margin: "8px 0" }}>Products</h1></div><Link className="btn btn-pink" href="/admin/products/new">+ Add product</Link></div>
    <div className="table-scroll"><table className="admin-table"><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody>{products?.map(p => <tr key={p.id}><td>{p.name}</td><td>{p.sku}</td><td>{p.category?.name ?? "—"}</td><td>₹{Number(p.price).toLocaleString("en-IN")}</td><td>{p.stock}</td><td>{p.archived ? "Archived" : p.available ? "Published" : "Draft"}</td><td><Link className="text-link" href={`/admin/products/${p.id}`}>Edit</Link> {!p.archived && <ArchiveButton id={p.id} />}</td></tr>)}</tbody></table></div>
  </>;
}
