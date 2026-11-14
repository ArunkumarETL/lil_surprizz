import { createAdminClient } from "@/lib/supabase/admin";
import { AdminCouponManager } from "@/components/admin-coupon-manager";
import { requireAdminPage } from "@/lib/admin-auth";
export const dynamic = "force-dynamic";
export default async function CouponsPage() {
  await requireAdminPage();
  const { data, error } = await createAdminClient().from("coupons").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(`Unable to load coupons: ${error.message}`);
  return <><span className="eyebrow">A little thank you</span><h1 style={{ fontSize: 38 }}>Coupons</h1><AdminCouponManager coupons={data ?? []} /></>;
}
