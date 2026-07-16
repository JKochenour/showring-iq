-- 00046: One-off data cleanup — decode literal HTML entities in name columns.
--
-- Spreadsheets exported from web-based systems (HSW reports, HTML copy-paste)
-- carried literal entities like "&apos;" into imported names, e.g.
-- horses.registered_name = '3Jets&apos; Winterhawk'. The import paths now
-- decode entities before insert (src/lib/import/normalize.ts); this migration
-- fixes rows that were imported before that fix.
--
-- Safe to run more than once: each pass decodes exactly one level of
-- encoding, and rows without entity sequences are never touched.
-- Plain ampersands ("Youth 13 & U") are left alone.

create or replace function pg_temp.decode_entities(t text)
returns text
language sql
immutable
as $$
  -- Named entities first; '&amp;' LAST so a double-encoded '&amp;apos;'
  -- decodes one level to '&apos;' instead of jumping straight to a quote.
  select replace(replace(replace(replace(replace(replace(replace(replace(replace(
    t,
    '&apos;', ''''),
    '&#39;',  ''''),
    '&#x27;', ''''),
    '&quot;', '"'),
    '&#34;',  '"'),
    '&lt;',   '<'),
    '&gt;',   '>'),
    '&nbsp;', ' '),
    '&amp;',  '&')
$$;

-- Matches only strings containing a decodable entity sequence, so the
-- UPDATEs skip (and don't bump updated_at on) already-clean rows.
create or replace function pg_temp.has_entities(t text)
returns boolean
language sql
immutable
as $$
  select t ~ '&(#39|#x27|#34|apos|quot|lt|gt|nbsp|amp);'
$$;

update public.horses
set registered_name = pg_temp.decode_entities(registered_name),
    barn_name       = pg_temp.decode_entities(barn_name),
    sire            = pg_temp.decode_entities(sire),
    dam             = pg_temp.decode_entities(dam),
    notes           = pg_temp.decode_entities(notes)
where pg_temp.has_entities(registered_name)
   or pg_temp.has_entities(barn_name)
   or pg_temp.has_entities(sire)
   or pg_temp.has_entities(dam)
   or pg_temp.has_entities(notes);

update public.people
set first_name     = pg_temp.decode_entities(first_name),
    last_name      = pg_temp.decode_entities(last_name),
    preferred_name = pg_temp.decode_entities(preferred_name),
    notes          = pg_temp.decode_entities(notes)
where pg_temp.has_entities(first_name)
   or pg_temp.has_entities(last_name)
   or pg_temp.has_entities(preferred_name)
   or pg_temp.has_entities(notes);

-- Classes created by the show-bill import can carry entities too.
update public.classes
set name = pg_temp.decode_entities(name)
where pg_temp.has_entities(name);

-- ---------------------------------------------------------------------------
-- Verification: both queries below must return zero rows afterward.
-- (Run these in the SQL editor after the updates.)
-- ---------------------------------------------------------------------------

select 'horses' as tbl, id, registered_name, barn_name, sire, dam
from public.horses
where registered_name ~ '&[#a-zA-Z0-9]+;'
   or barn_name ~ '&[#a-zA-Z0-9]+;'
   or sire ~ '&[#a-zA-Z0-9]+;'
   or dam ~ '&[#a-zA-Z0-9]+;';

select 'people' as tbl, id, first_name, last_name, preferred_name
from public.people
where first_name ~ '&[#a-zA-Z0-9]+;'
   or last_name ~ '&[#a-zA-Z0-9]+;'
   or preferred_name ~ '&[#a-zA-Z0-9]+;';
