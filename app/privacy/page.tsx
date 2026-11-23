import { getStoreSettings } from "@/lib/catalog";
export const dynamic = "force-dynamic";
export const metadata = { title: "Privacy policy" };
export default function PrivacyPage() {
  return <PrivacyContent />;
}

async function PrivacyContent() {
  const settings = await getStoreSettings();
  return <main className="section wrap" style={{ maxWidth: 820 }}><span className="eyebrow">The important bits</span><h1 style={{ fontSize: 44 }}>Privacy policy</h1>
    <p className="muted">LILSURPRIZ respects your privacy. We collect your name, phone number, email address, and delivery address to process and deliver orders and respond to enquiries.</p>
    <h2>How we use your information</h2><p className="muted">We use this information to manage your account, process and deliver orders, provide customer support, and respond to your enquiries. We do not sell customers’ personal information.</p>
    <h2>Order photos and payments</h2><p className="muted">Photos submitted for personalised products are stored privately for order fulfillment. A time-limited photo link is included in the WhatsApp order request and expires after 7 days; authorised store administrators can access saved order photos to process and support the order. Order requests do not take payment on the website. We arrange payment directly with you, and will never ask you to share a payment PIN or one-time password.</p>
    <h2>Privacy questions</h2><p className="muted">For privacy questions, contact <a className="text-link" href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a>.</p>
  </main>;
}
