import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";

const links = [["Overview", "/admin"], ["Products", "/admin/products"], ["Add product", "/admin/products/new"], ["Categories", "/admin/categories"], ["Box colours", "/admin/box-colours"], ["Orders", "/admin/orders"], ["Customers", "/admin/customers"], ["Custom enquiries", "/admin/enquiries"], ["Coupons", "/admin/coupons"], ["Website settings", "/admin/settings"]];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return <main className="admin-shell"><aside className="admin-side"><b style={{ display: "block", padding: "8px 13px 15px" }}>LILSURPRIZ ADMIN</b>{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</aside><section className="admin-content">{children}</section></main>;
}
