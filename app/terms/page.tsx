import { getStoreSettings } from "@/lib/catalog";
export const dynamic = "force-dynamic";
export const metadata = { title: "Terms and conditions" };
export default function TermsPage() {
  return <TermsContent />;
}

async function TermsContent() {
  const settings = await getStoreSettings();
  return <main className="section wrap" style={{ maxWidth: 820 }}><span className="eyebrow">Using our store</span><h1 style={{ fontSize: 44 }}>Terms and conditions</h1>
    <ul className="muted"><li>All prices are displayed in Indian Rupees (INR).</li><li>Orders depend on product availability.</li><li>Customers must provide correct delivery details.</li><li>Product colours may vary slightly from photographs.</li><li>Custom gift boxes are prepared according to confirmed requirements.</li><li>Delivery times may vary depending on location.</li><li>By placing an order, customers agree to these terms.</li></ul>
    <p className="muted">An order is marked paid only after payment is verified by our payment provider. For questions about these terms, contact <a className="text-link" href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a>.</p>
  </main>;
}
