alter table public.store_settings
  add column if not exists business_phone text not null default '9585664547',
  add column if not exists business_address text not null default '41/A Rajiv Gandhi street, Pallikaranai, Chennai';

update public.store_settings
set brand_name = 'LILSURPRIZ',
    business_phone = '9585664547',
    business_address = '41/A Rajiv Gandhi street, Pallikaranai, Chennai',
    whatsapp_number = '9585664547',
    contact_email = 'lilsurpriz@gmail.com'
where id = 1;
