import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminPage } from "@/lib/admin-auth";
export const dynamic = "force-dynamic";
export default async function CustomersPage() {
  await requireAdminPage();
  const { data, error } = await createAdminClient().from("customers").select("id,full_name,email,phone,created_at").order("created_at", { ascending: false });
  if (error) throw new Error(`Unable to load customers: ${error.message}`);
  return <><span className="eyebrow">Your community</span><h1 style={{ fontSize: 38 }}>Customers</h1><div className="table-scroll"><table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Customer ID</th><th>Joined</th></tr></thead><tbody>{data?.map(c => <tr key={c.id}><td>{c.full_name || "—"}</td><td>{c.email || "—"}</td><td>{c.phone || "—"}</td><td>{c.id}</td><td>{new Date(c.created_at).toLocaleDateString("en-IN")}</td></tr>)}</tbody></table></div></>;
}
