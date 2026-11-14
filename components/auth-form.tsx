"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AuthForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setMessage("");
    try {
      const { data, error } = await createClient().auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.href = data.user.app_metadata.role === "admin" ? "/admin" : "/account";
    } catch (error) { setMessage(error instanceof Error ? error.message : "Sign-in failed."); }
    finally { setLoading(false); }
  }
  async function signUp() {
    setLoading(true); setMessage("");
    try {
      const { error } = await createClient().auth.signUp({ email, password });
      if (error) throw error;
      setMessage("Check your email to confirm your account, then sign in.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Account creation failed."); }
    finally { setLoading(false); }
  }
  return <form className="form" onSubmit={signIn}><div className="field"><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
    <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} /></div>
    <button className="btn btn-pink" disabled={loading}>{loading ? "Please wait…" : "Sign in"}</button><button type="button" className="btn btn-light" disabled={loading} onClick={signUp}>Create an account</button>
    {message && <p className="notice" role="status">{message}</p>}
  </form>;
}
