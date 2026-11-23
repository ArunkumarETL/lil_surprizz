# LILSURPRIZ

Mobile-first ecommerce application built with Next.js and Supabase.

## Local setup

1. Install Node.js 20+ and run `npm install`.
2. Create a Supabase project. In its SQL editor, run [`supabase/schema.sql`](./supabase/schema.sql).
3. Copy `.env.example` to `.env.local`; set the Supabase project URL, anon key, service-role key, and site URL. Keep the service-role key server-side; never prefix it with `NEXT_PUBLIC_`.
4. In Supabase Authentication, enable email/password sign-in. Create your admin user, then assign `{"role":"admin"}` in that user’s **app_metadata** using the Supabase dashboard or trusted server-side admin tooling. Do not put the role in user-editable `user_metadata`.
5. Run `npm run dev`, then sign in at `/account`. Admin users can open `/admin`.

## Features

- Product, category, stock, price, image, and settings management is backed by Supabase.
- Product and logo images are stored in the `product-images` Storage bucket. Product images are resized to a 1600px maximum dimension and WebP-encoded in the browser.
- Orders are re-priced and stock-checked on the server. Customers can submit an order request as guests with delivery details and optional product photos. Checkout does not take payment; customers review and send the prepared order details in WhatsApp, and the store arranges payment directly. Admins manage fulfillment and ST Courier tracking numbers manually.
- Existing Cashfree orders can still be reconciled through the payment webhook; Cashfree is no longer offered for new checkout orders.
- Customers may sign in to view account features, but checkout does not require an account. Admin checks use the trusted JWT `app_metadata.role` claim and are repeated for each admin API request.

## Production checklist

- Configure production Supabase credentials in Vercel environment variables.
- For an existing Supabase project, apply [`supabase/migrations/20261123130000_whatsapp_order_photos.sql`](./supabase/migrations/20261123130000_whatsapp_order_photos.sql) before enabling customer photo uploads.
- Apply [`supabase/migrations/20261123131000_set_whatsapp_order_number.sql`](./supabase/migrations/20261123131000_set_whatsapp_order_number.sql) and [`supabase/migrations/20261123132500_allow_whatsapp_order_requests.sql`](./supabase/migrations/20261123132500_allow_whatsapp_order_requests.sql) to configure the WhatsApp destination and allow WhatsApp orders without a payment reference.
- Apply [`supabase/migrations/20261116100000_guest_checkout.sql`](./supabase/migrations/20261116100000_guest_checkout.sql) to an existing project to allow guest-created orders.
- Set `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS deployment URL.
- Review legal policies, shipping charges, delivery estimates, and refund terms for the actual business.
- Create active categories and products in `/admin`.
- Test account confirmation, admin access, image upload, stock validation, WhatsApp order requests, order fulfilment, and mobile layouts against the configured services.

`npm run build` and `npm run typecheck` validate the app source. A live payment, authenticated admin workflow, or Storage upload cannot be truthfully integration-tested until project credentials are supplied.
