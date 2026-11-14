import { createAdminClient } from "@/lib/supabase/admin";
import { AdminEnquiryActions } from "@/components/admin-enquiry-actions";
import { requireAdminPage } from "@/lib/admin-auth";
export const dynamic = "force-dynamic";
export default async function EnquiriesPage() {
  await requireAdminPage();
  const { data, error } = await createAdminClient().from("custom_enquiries").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(`Unable to load enquiries: ${error.message}`);
  return <><span className="eyebrow">Make it personal</span><h1 style={{ fontSize: 38 }}>Custom enquiries</h1><div className="table-scroll"><table className="admin-table"><thead><tr><th>Date</th><th>Recipient / occasion</th><th>Items</th><th>Estimate</th><th>Message & notes</th><th>Status</th></tr></thead><tbody>{data?.map(item => <tr key={item.id}><td>{new Date(item.created_at).toLocaleDateString("en-IN")}</td><td>{item.recipient_name}<br />{item.occasion} · {item.box_colour}</td><td>{(item.selected_items as Array<{ name: string; quantity: number }>).map(i => `${i.name} ×${i.quantity}`).join(", ")}</td><td>₹{Number(item.estimated_total).toLocaleString("en-IN")}</td><td>{item.personal_message}<br /><small>{item.special_instructions}</small></td><td><AdminEnquiryActions id={item.id} status={item.status} /></td></tr>)}</tbody></table></div></>;
}
