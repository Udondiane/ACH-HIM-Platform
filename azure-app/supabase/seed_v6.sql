delete from public.partner_contacts
 where partner_id = $bk$11111111-1111-1111-1111-000000000006$bk$::uuid;

delete from public.partners
 where id = $bk$11111111-1111-1111-1111-000000000006$bk$::uuid;
