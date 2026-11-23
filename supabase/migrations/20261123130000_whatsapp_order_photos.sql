insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-order-photos',
  'customer-order-photos',
  false,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

update public.store_settings
set upi_id = '',
    upi_qr_url = null,
    updated_at = now()
where id = 1;
