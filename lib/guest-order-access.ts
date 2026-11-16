import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createGuestOrderAccessToken() {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

export function canAccessOrder(
  order: { customer_id: string | null; payment_details: unknown },
  userId: string | null,
  token: string | null,
) {
  if (order.customer_id) return userId === order.customer_id;
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return false;

  const details = order.payment_details as { guest_access_token_hash?: unknown } | null;
  const storedHash = details?.guest_access_token_hash;
  if (typeof storedHash !== "string" || !/^[a-f0-9]{64}$/i.test(storedHash)) return false;

  return timingSafeEqual(Buffer.from(hashToken(token), "hex"), Buffer.from(storedHash, "hex"));
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
