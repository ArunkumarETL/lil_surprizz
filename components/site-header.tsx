"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/components/store-provider";
import { createClient } from "@/lib/supabase/client";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [brand, setBrand] = useState("LILSURPRIZ");
  const [announcement, setAnnouncement] = useState("Little gifts, big surprises.");
  const [logo, setLogo] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const { count } = useCart();
  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" }).then(async response => {
      if (!response.ok) return;
      const settings = await response.json() as { brand_name: string; announcement: string; logo_url: string | null };
      setBrand(settings.brand_name); setAnnouncement(settings.announcement); setLogo(settings.logo_url);
    }).catch(() => undefined);
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => setIsAdmin(data.user?.app_metadata.role === "admin"));
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setIsAdmin(session?.user.app_metadata.role === "admin");
      });
      return () => subscription.unsubscribe();
    } catch {
      setIsAdmin(false);
    }
  }, []);
  const links = [["Shop all", "/shop"], ["Our story", "/about"]];
  return <>
    <div className="announcement">{announcement}</div>
    <header className="header"><nav className="nav">
      <button className="mobile-menu" aria-label="Toggle navigation" onClick={() => setOpen(!open)}>☰</button>
      <Link className="logo" href="/">
        {logo ? <><img src={logo} alt={brand} style={{ maxHeight: 40, maxWidth: 155, objectFit: "contain" }} /><span className="logo-wordmark">{brand}</span></> : <>
          <span className="brand-symbol"><img src="/brand/lilsurpriz-emblem.png" alt="" /></span>
          {brand}
        </>}
      </Link>
      <div className="navlinks">{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</div>
      <div className="navactions">{isAdmin && <Link href="/admin">Admin</Link>}<Link href="/orders">My orders</Link><Link href="/account">Account</Link><Link href="/cart" aria-label={`Cart, ${count} items`}>Bag ({count})</Link></div>
      {open && <div className="mobile-nav">{links.map(([label, href]) => <Link onClick={() => setOpen(false)} key={href} href={href}>{label}</Link>)}<Link onClick={() => setOpen(false)} href="/orders">My orders</Link>{isAdmin && <Link onClick={() => setOpen(false)} href="/admin">Admin dashboard</Link>}</div>}
    </nav></header>
  </>;
}
