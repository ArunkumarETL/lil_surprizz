insert into public.store_settings (id, whatsapp_number)
values (1, '9585664547')
on conflict (id) do update
set whatsapp_number = excluded.whatsapp_number,
    updated_at = now();
