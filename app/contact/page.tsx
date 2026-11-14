import { getStoreSettings } from "@/lib/catalog";
export const dynamic = "force-dynamic";
export const metadata = { title: "Contact us", description: "Contact the LILSURPRIZ gifting team." };
export default async function ContactPage() {
  const settings = await getStoreSettings();
  const whatsapp = settings.whatsapp_number.replace(/\D/g, "");
  return <main className="section wrap" style={{ maxWidth: 720 }}><span className="eyebrow">We’re happy to help</span><h1 style={{ fontSize: 46 }}>Let’s talk gifts.</h1><p className="muted">Questions about an order, a custom hamper, or just need a little help picking a gift? Get in touch.</p><div className="summary form">
    {settings.contact_email && <p><b>Email us</b><br /><a className="text-link" href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a></p>}
    {whatsapp && <p><b>WhatsApp</b><br /><a className="text-link" target="_blank" rel="noreferrer" href={`https://wa.me/${whatsapp}`}>Message LILSURPRIZ</a></p>}
    {settings.instagram_url && <p><b>Instagram</b><br /><a className="text-link" target="_blank" rel="noreferrer" href={settings.instagram_url}>Follow along</a></p>}
    {!settings.contact_email && !whatsapp && <p className="notice">Contact channels are being set up. Please check back soon.</p>}
  </div></main>;
}
