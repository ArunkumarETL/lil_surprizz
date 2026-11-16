export type SavedGuestOrder = {
  orderId: string;
  orderNumber: string;
  createdAt: string;
};

const guestOrdersKey = "lilsurpriz-guest-orders";

function accessTokenKey(orderId: string) {
  return `lilsurpriz-order-access:${orderId}`;
}

function isOrderId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isAccessToken(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function isSavedGuestOrder(value: unknown): value is SavedGuestOrder {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const order = value as Record<string, unknown>;
  return isOrderId(order.orderId)
    && typeof order.orderNumber === "string"
    && typeof order.createdAt === "string";
}

export function readSavedGuestOrders(): SavedGuestOrder[] {
  const saved = localStorage.getItem(guestOrdersKey);
  if (!saved) return [];
  const parsed: unknown = JSON.parse(saved);
  if (!Array.isArray(parsed)) throw new Error("Saved guest order data is invalid.");
  return parsed.filter(isSavedGuestOrder);
}

export function getGuestOrderAccessToken(orderId: string) {
  const token = localStorage.getItem(accessTokenKey(orderId));
  return isAccessToken(token) ? token : "";
}

export function rememberGuestOrder(orderId: string, orderNumber: string, token: string) {
  if (!isOrderId(orderId) || !isAccessToken(token)) throw new Error("Invalid guest order access details.");
  localStorage.setItem(accessTokenKey(orderId), token);
  const orders = readSavedGuestOrders().filter(order => order.orderId !== orderId);
  orders.unshift({ orderId, orderNumber: orderNumber.slice(0, 100), createdAt: new Date().toISOString() });
  localStorage.setItem(guestOrdersKey, JSON.stringify(orders));
}

export function removeSavedGuestOrder(orderId: string) {
  localStorage.removeItem(accessTokenKey(orderId));
  const orders = readSavedGuestOrders().filter(order => order.orderId !== orderId);
  localStorage.setItem(guestOrdersKey, JSON.stringify(orders));
}
