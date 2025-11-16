# Account Security Supabase Tables

The `/account/security` experience expects three supporting tables in Supabase. These SQL snippets can be run inside the Supabase SQL editor (or any PostgreSQL client) to provision the required schema. All tables live in the `public` schema and reference `auth.users(id)` for ownership.

## `user_sessions`
```sql
create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_name text,
  browser text,
  os text,
  ip_address text,
  created_at timestamptz not null default now(),
  last_active timestamptz,
  is_active boolean not null default true
);

create index if not exists user_sessions_user_id_created_at_idx
  on public.user_sessions (user_id, created_at desc);
```
- Supplies the recent session list rendered on `/account/security` (`app.js` lines 688-701).

## `notification_preferences`
```sql
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_updates boolean not null default true,
  marketing_emails boolean not null default false,
  product_announcements boolean not null default true,
  security_alerts boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger set_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute procedure trigger_set_timestamp();
```
- Stores the alert toggle that `/api/account/security-alerts` upserts (`app.js` lines 905-930).

## `password_reset_codes`
```sql
create table if not exists public.password_reset_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_codes_lookup_idx
  on public.password_reset_codes (user_id, code, used, expires_at);
```
- Persists the 10-minute verification codes for the password reset flow (`app.js` lines 808-838 and 858-889).

> **Tip:** If your project uses Row Level Security, remember to add policies so authenticated users can only see and modify their own rows (e.g., `user_id = auth.uid()`).
