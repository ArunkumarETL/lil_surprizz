"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function SiteFooter() {
  const [settings, setSettings] = useState({ brand_name: "LILSURPRIZ", instagram_url: "", social_links: {} as Record<string, string> });
  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" }).then(async response => {
      if (!response.ok) return;
      const data = await response.json() as { brand_name: string; instagram_url: string; social_links: Record<string, string> };
      setSettings(data);
    }).catch(() => undefined);
  }, []);
  return <footer className="footer"><div className="wrap">
    <div className="footer-grid">
      <div><Link className="logo" href="/" style={{ color: "white" }}>{settings.brand_name}</Link><p>Little gifts, big surprises.<br />Curated with love, sent with a smile.</p><div style={{ display: "flex", gap: 14 }}>{settings.instagram_url && <a href={settings.instagram_url} target="_blank" rel="noreferrer">Instagram</a>}{settings.social_links.facebook && <a href={settings.social_links.facebook} target="_blank" rel="noreferrer">Facebook</a>}{settings.social_links.youtube && <a href={settings.social_links.youtube} target="_blank" rel="noreferrer">YouTube</a>}</div></div>
      <div><h3>Explore</h3><Link href="/shop">Shop all</Link><br /><Link href="/customise">Build your hamper</Link><br /><Link href="/about">Our story</Link><br /><Link href="/contact">Contact</Link></div>
      <div><h3>Help & policies</h3><Link href="/shipping">Shipping</Link><br /><Link href="/refunds">Refunds</Link><br /><Link href="/privacy">Privacy</Link><br /><Link href="/terms">Terms</Link></div>
    </div><div className="footer-bottom">© {new Date().getFullYear()} LILSURPRIZ. Made for the moments that matter.</div>
  </div></footer>;
}
