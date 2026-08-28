-- Local mirror of the Lenny's Data archive (newsletter posts + podcast transcripts).
--
-- Replaces the live LennyData MCP dependency in the generate-teardown Edge Function.
-- The corpus is synced from the periodic ZIP export by scripts/sync-lenny-corpus.mjs
-- and searched here with Postgres full-text search. Runbook: scripts/sync-lenny-corpus.md
--
-- Retrieval is lexical (tsquery), matching the character of the old MCP's
-- search_content tool. A semantic `embedding vector` column can be added later
-- without touching this schema.

create table if not exists public.lenny_corpus (
  id             uuid primary key default gen_random_uuid(),
  filename       text not null unique,          -- archive-relative path, e.g. "03-podcasts/madhavan-ramanujam.md"
  content_type   text not null check (content_type in ('podcast', 'newsletter')),
  title          text not null,
  published_date date,
  tags           text[] not null default '{}',
  source_url     text,
  word_count     integer,
  content        text not null,                 -- full markdown body, frontmatter stripped
  content_hash   text not null,                 -- sha256 of the raw file; drives sync diffing
  synced_at      timestamptz not null default now(),
  fts            tsvector                       -- maintained by trigger below
);

-- to_tsvector(regconfig, text) is only STABLE, so `fts` can't be a GENERATED
-- column. A before-insert/update trigger is the portable equivalent.
create or replace function public.lenny_corpus_fts_update()
returns trigger
language plpgsql
as $fn$
begin
  new.fts :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', array_to_string(new.tags, ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.content, '')), 'C');
  return new;
end;
$fn$;

create trigger lenny_corpus_fts_trg
  before insert or update of title, tags, content on public.lenny_corpus
  for each row execute function public.lenny_corpus_fts_update();

create index if not exists lenny_corpus_fts_idx
  on public.lenny_corpus using gin (fts);
create index if not exists lenny_corpus_content_type_idx
  on public.lenny_corpus (content_type);

-- Service-role only. The Edge Function reads this with the service key; no browser
-- client ever touches it. RLS on with zero policies => anon/authenticated see nothing.
alter table public.lenny_corpus enable row level security;
grant select, insert, update, delete on public.lenny_corpus to service_role;

comment on table public.lenny_corpus is
  'Local mirror of Lenny''s Data archive. Synced from the ZIP export via scripts/sync-lenny-corpus.mjs; searched by generate-teardown through search_lenny_corpus().';


-- Pipe-delimited keyword search, mirroring the shape the LennyData MCP returned.
-- `q` is a string like "pricing|monetization|revenue model": each |-separated term
-- becomes an OR group (plainto_tsquery per term, combined with ||). Returns up to
-- match_limit sources ranked by relevance, each with up to 3 fragments pulled from
-- the body. `filter_type` = 'podcast' | 'newsletter' | '' (no filter).
create or replace function public.search_lenny_corpus(
  q            text,
  match_limit  integer default 5,
  filter_type  text    default ''
)
returns table (
  filename       text,
  title          text,
  content_type   text,
  published_date date,
  source_url     text,
  rank           real,
  headline       text
)
language plpgsql
stable
as $fn$
declare
  ts   tsquery := null;
  part text;
begin
  foreach part in array string_to_array(coalesce(q, ''), '|') loop
    part := trim(part);
    if part <> '' then
      ts := case
              when ts is null then plainto_tsquery('english', part)
              else ts || plainto_tsquery('english', part)
            end;
    end if;
  end loop;

  if ts is null then
    return;
  end if;

  return query
    select
      c.filename,
      c.title,
      c.content_type,
      c.published_date,
      c.source_url,
      ts_rank_cd(c.fts, ts)::real as rank,
      -- ts_headline rejects empty Start/StopSel, so strip its default <b> markup.
      regexp_replace(
        ts_headline(
          'english', c.content, ts,
          'MaxFragments=3, MinWords=12, MaxWords=44, ShortWord=3, FragmentDelimiter=" … "'
        ),
        '</?b>', '', 'g'
      ) as headline
    from public.lenny_corpus c
    where c.fts @@ ts
      and (coalesce(filter_type, '') = '' or c.content_type = filter_type)
    order by rank desc, c.published_date desc nulls last
    limit greatest(match_limit, 1);
end;
$fn$;

revoke all on function public.search_lenny_corpus(text, integer, text) from anon, authenticated;
grant execute on function public.search_lenny_corpus(text, integer, text) to service_role;
