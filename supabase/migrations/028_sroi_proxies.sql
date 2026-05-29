/* SROI proxy values per HIM capability domain. Following Social Value
   UK guidance and published proxies in common use. Values are
   indicative and must be verified against the buyer's preferred
   SROI version before any commitment.

   The HIM platform's PRIMARY measurement is capability uplift; SROI
   here is a translation layer for buyers (corporate ESG, non-procurement
   CSR) that expect a £-denominated anchor alongside the qualitative
   evidence. */

create table if not exists public.sroi_proxies (
  capability         text primary key,
  proxy_label        text not null,
  proxy_value_pence  integer not null,
  source             text,
  source_year        integer,
  notes              text
);

insert into public.sroi_proxies (capability, proxy_label, proxy_value_pence, source, source_year, notes) values
  ('employment', 'Securing sustained employment',          1400000, 'Social Value UK / HACT (indicative)', 2024, 'Per refugee placed into work consistent with their capability'),
  ('housing',    'Stable, secure housing',                  900000, 'Social Value UK / HACT (indicative)', 2024, 'Per person achieving housing stability'),
  ('education',  'Qualification or skills gained',          500000, 'Social Value UK (indicative)',         2024, 'Per accredited qualification or significant skills milestone'),
  ('health',     'Improved mental wellbeing and resilience',1000000, 'Social Value UK / HACT (indicative)',  2024, 'Per person reporting sustained wellbeing improvement'),
  ('belonging',  'Sense of belonging in community',         400000, 'Social Value UK (indicative)',         2024, 'Per person achieving identity / cultural anchoring'),
  ('social',     'Active social participation',             350000, 'Social Value UK (indicative)',         2024, 'Per person with stable peer / civic network'),
  ('rights',     'Rights literacy and citizenship pathway', 250000, 'Social Value UK (indicative)',         2024, 'Per person with clear, supported rights position')
on conflict (capability) do nothing;

comment on table public.sroi_proxies is
  'SROI £ proxy per HIM capability domain. Indicative; verify against the buyer''s preferred SROI version before any monetised claim.';
