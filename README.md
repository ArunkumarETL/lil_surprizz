# LILSURPRIZ

Mobile-first ecommerce application built with Next.js, Supabase and Cashfree hosted checkout.

## Local setup

1. Install Node.js 20+ and run `npm install`.
2. Create a Supabase project. In its SQL editor, run [`supabase/schema.sql`](./supabase/schema.sql).
3. Copy `.env.example` to `.env.local`; set the Supabase project URL, anon key, service-role key, and site URL. Keep the service-role and Cashfree secrets server-side; never prefix them with `NEXT_PUBLIC_`.
4. In Supabase Authentication, enable email/password sign-in. Create your admin user, then assign `{"role":"admin"}` in that user’s **app_metadata** using the Supabase dashboard or trusted server-side admin tooling. Do not put the role in user-editable `user_metadata`.
5. Add Cashfree sandbox app credentials to `.env.local`. Set the webhook URL in Cashfree to `https://YOUR_SITE/api/payments/webhook`; subscribe to payment events. Set `CASHFREE_ENV=sandbox` until production access is approved.
6. Run `npm run dev`, then sign in at `/account`. Admin users can open `/admin`.

## Features

- Product, category, stock, price, image, and settings management is backed by Supabase.
- Product and logo images are stored in the `product-images` Storage bucket. Product images are resized to a 1600px maximum dimension and WebP-encoded in the browser.
- Orders are re-priced and stock-checked on the server. Cashfree payment credentials stay in server environment variables. Only a signed webhook followed by a server-to-server Cashfree order-status check calls the idempotent `mark_order_paid` database function.
- Customers sign in with Supabase Auth. Admin checks use the trusted JWT `app_metadata.role` claim and are repeated for each admin API request.
- WhatsApp hamper submissions are saved as enquiries and are never treated as paid orders.

## Production checklist

- Configure production Supabase and Cashfree credentials in Vercel environment variables; use the Cashfree production environment only after merchant approval.
- Configure the production Cashfree webhook and verify webhook delivery in Cashfree’s dashboard.
- Set `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS deployment URL.
- Review legal policies, shipping charges, delivery estimates, and refund terms for the actual business.
- Create active categories and products in `/admin`; no seeded or hard-coded product catalogue is used.
- Test account confirmation, admin access, image upload, stock validation, order fulfilment, sandbox payment, webhook verification, WhatsApp deep-links, and mobile layouts against the configured services.

`npm run build` and `npm run typecheck` validate the app source. A live payment, authenticated admin workflow, or Storage upload cannot be truthfully integration-tested until project credentials and Cashfree sandbox access are supplied.
