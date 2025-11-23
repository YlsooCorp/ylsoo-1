# Teams & Leadership Supabase Table

The `/teams` page reads from a dedicated `core_team_members` table so the most important Ylsoo leaders can be managed directly in Supabase. Run the SQL below in the Supabase SQL editor (or any PostgreSQL client) to create it.

```sql
create table if not exists public.core_team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text not null,
  team_name text,
  focus_area text,
  bio text,
  photo_url text,
  location text,
  joined_year integer,
  priority integer not null default 999,
  notable_wins text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists core_team_members_priority_idx
  on public.core_team_members (priority, joined_year desc, created_at desc);

create trigger set_core_team_members_updated_at
  before update on public.core_team_members
  for each row execute procedure trigger_set_timestamp();
```

- `priority` controls ordering on the `/teams` page (lowest number shows first) while `joined_year` is used as a secondary sort.
- `notable_wins` lets you store short bullet points that render beneath each member’s bio.
- Add Row Level Security policies if needed (e.g., restricting insert/update to admins) to keep the roster safe.
