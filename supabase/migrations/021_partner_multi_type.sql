/* Multi-type partners. A single organisation may simultaneously be a
   workforce partner (hires candidates), capability investor (sponsors
   cohorts) and training partner (receives ED&I training). The legacy
   single `type` column forced an artificial choice; this migration
   replaces it with a `types` array. */

alter table public.partners
  add column if not exists types public.partner_type[] not null default '{}';

update public.partners
   set types = array[type]
 where type is not null
   and (types is null or array_length(types, 1) is null);

create index if not exists idx_partners_types on public.partners using gin (types);

/* Keep the legacy `type` column populated as types[1] so any external
   query or report that still reads it does not break. Trigger keeps
   them in sync going forward. */
create or replace function public.sync_partner_type_from_types()
returns trigger language plpgsql as $body$
begin
  if NEW.types is not null and array_length(NEW.types, 1) >= 1 then
    NEW.type := NEW.types[1];
  end if;
  return NEW;
end;
$body$;

drop trigger if exists trg_sync_partner_type on public.partners;
create trigger trg_sync_partner_type
  before insert or update of types on public.partners
  for each row execute function public.sync_partner_type_from_types();

alter table public.partners
  alter column type drop not null;
