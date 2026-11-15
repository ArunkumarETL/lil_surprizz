import { getStoreSettings } from "@/lib/catalog";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";
export const dynamic = "force-dynamic";
export const metadata = { title: "Contact us", description: "Contact the LILSURPRIZ gifting team." };
export default async function ContactPage() {
  const settings = await getStoreSettings();
  const whatsapp = normalizeWhatsAppNumber(settings.whatsapp_number);
  return <main className="section wrap" style={{ maxWidth: 720 }}><span className="eyebrow">We’re happy to help</span><h1 style={{ fontSize: 46 }}>Let’s talk gifts.</h1><p className="muted">Questions about an order, a custom hamper, or just need a little help picking a gift? Get in touch.</p><div className="summary form">
    <p><b>Business</b><br />{settings.brand_name}</p>
    <p><b>Email</b><br /><a className="text-link" href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a></p>
    <p><b>Phone</b><br /><a className="text-link" href={`tel:${settings.business_phone.replace(/\D/g, "")}`}>{settings.business_phone}</a></p>
    {whatsapp && <p><b>WhatsApp</b><br /><a className="text-link" target="_blank" rel="noreferrer" href={`https://wa.me/${whatsapp}`}>{settings.whatsapp_number}</a></p>}
    <p><b>Address</b><br />{settings.business_address}</p>
    {settings.instagram_url && <p><b>Instagram</b><br /><a className="text-link" target="_blank" rel="noreferrer" href={settings.instagram_url}>Follow along</a></p>}
  </div></main>;
}
