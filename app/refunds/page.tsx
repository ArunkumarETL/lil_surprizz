import { getStoreSettings } from "@/lib/catalog";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";
export const dynamic = "force-dynamic";
export const metadata = { title: "Refund and cancellation policy" };
export default function RefundsPage() {
  return <RefundPolicy />;
}

async function RefundPolicy() {
  const settings = await getStoreSettings();
  const phone = normalizeWhatsAppNumber(settings.whatsapp_number);
  return <main className="section wrap" style={{ maxWidth: 820 }}><span className="eyebrow">Here if something goes wrong</span><h1 style={{ fontSize: 44 }}>Refund & return policy</h1>
    <ul className="muted"><li>Orders generally cannot be cancelled once confirmed.</li><li>Custom gift boxes cannot be cancelled once preparation begins.</li><li>Report damaged or incorrect products within 48 hours of delivery.</li><li>Report missing items within 48 hours of delivery.</li><li>Change-of-mind returns are not accepted for correctly delivered products.</li></ul>
    <h2>Refunds</h2><p className="muted">Eligible refunds will generally be initiated within 5–7 business days after approval. Refunds will be processed through the original payment method wherever possible.</p>
    <h2>Refund assistance</h2><p className="muted">Email: <a className="text-link" href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a>{phone && <><br />WhatsApp: <a className="text-link" href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer">{settings.whatsapp_number}</a></>}</p>
  </main>;
}
