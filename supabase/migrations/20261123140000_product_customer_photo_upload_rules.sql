alter table public.products
  add column if not exists customer_photo_mode text not null default 'optional'
    check (customer_photo_mode in ('none', 'optional', 'required')),
  add column if not exists customer_photo_limit smallint not null default 10
    check (customer_photo_limit between 1 and 10);

alter table public.products
  alter column customer_photo_mode set default 'none',
  alter column customer_photo_limit set default 1;
