"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { createClient } from "@/lib/supabase/client";

export default function AccountPage() {
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { createClient().auth.getUser().then(({ data }) => { setUser(data.user); setReady(true); }); }, []);
  async function signOut() { await createClient().auth.signOut(); setUser(null); }
  return <main className="section wrap" style={{ maxWidth: 560 }}><span className="eyebrow">Your little corner</span><h1 style={{ fontSize: 43 }}>My account</h1>
    {!ready ? <p className="muted">Checking your account…</p> : user ? <div className="form"><p>Signed in as <b>{user.email}</b></p><Link className="btn btn-pink" href="/orders">View my orders</Link><button className="btn btn-light" onClick={signOut}>Sign out</button></div> : <AuthForm />}
  </main>;
}
