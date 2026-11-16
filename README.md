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
- Orders are re-priced and stock-checked on the server. Customers can check out as guests with delivery details, without signing in. Checkout uses manual UPI only. Configure the UPI ID and upload the merchant QR in `/admin/settings`; customer-submitted UTRs stay unverified until an admin checks GPay and confirms the payment in `/admin/orders`.
- Existing Cashfree orders can still be reconciled through the payment webhook; Cashfree is no longer offered for new checkout orders.
- Customers may sign in to view account features, but checkout does not require an account. Guest payment links use unguessable, single-order access tokens. Admin checks use the trusted JWT `app_metadata.role` claim and are repeated for each admin API request.
- WhatsApp hamper submissions are saved as enquiries and are never treated as paid orders.

## Production checklist

- Configure production Supabase credentials in Vercel environment variables.
- For an existing Supabase project, apply [`supabase/migrations/20261115161200_manual_upi_payments.sql`](./supabase/migrations/20261115161200_manual_upi_payments.sql) before deploying manual UPI checkout.
- Apply [`supabase/migrations/20261116100000_guest_checkout.sql`](./supabase/migrations/20261116100000_guest_checkout.sql) to an existing project to allow guest-created orders.
- Set the UPI ID and upload the merchant QR in `/admin/settings` after the migration is applied.
- Set `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS deployment URL.
- Review legal policies, shipping charges, delivery estimates, and refund terms for the actual business.
- Create active categories and products in `/admin`; no seeded or hard-coded product catalogue is used.
- Test account confirmation, admin access, image upload, stock validation, manual UPI reference submission and admin verification, order fulfilment, WhatsApp deep-links, and mobile layouts against the configured services.

`npm run build` and `npm run typecheck` validate the app source. A live payment, authenticated admin workflow, or Storage upload cannot be truthfully integration-tested until project credentials are supplied.
