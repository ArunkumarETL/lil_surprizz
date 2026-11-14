import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireAdminPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || user.app_metadata.role !== "admin") redirect("/account");
  return user;
}

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  if (user.app_metadata.role !== "admin") {
    return { response: NextResponse.json({ error: "Administrator access required." }, { status: 403 }) };
  }
  return { user };
}
