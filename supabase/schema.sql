-- ============================================================
-- Lead Routing Portal - Supabase Schema
-- Pay-Per-Lead mit direkter Kunden-Zuweisung (kein Kampagnen-Layer)
-- Ausfuehren im Supabase SQL Editor
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. Tabelle: profiles (1:1 zu auth.users)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'client' check (role in ('admin', 'client')),
  company_name text,
  default_lead_price numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. Tabelle: leads
-- ------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.profiles (id) on delete set null,
  first_name text,
  last_name text,
  email text,
  phone text,
  custom_data jsonb not null default '{}'::jsonb,
  source text not null check (source in ('meta_lead_form', 'landingpage')),
  fbclid text,
  status text not null default 'pending' check (status in ('pending', 'qualified', 'rejected')),
  price numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_client_id_idx on public.leads (client_id);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_created_at_idx on public.leads (created_at desc);

-- ------------------------------------------------------------
-- 3. Helper: is_admin() - security definer verhindert
--    rekursive RLS-Auswertung auf profiles
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ------------------------------------------------------------
-- 4. Trigger: Profil automatisch bei Signup anlegen
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, company_name, default_lead_price)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'role', 'client'),
    new.raw_user_meta_data ->> 'company_name',
    coalesce((new.raw_user_meta_data ->> 'default_lead_price')::numeric, 0)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 5. Trigger: updated_at + Schutz sensibler Felder
--    Clients duerfen NUR den Status aendern (kein Preis, keine Zuweisung).
--    Admins und die Service-Role (Inbound API) duerfen alles.
-- ------------------------------------------------------------
create or replace function public.handle_lead_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and not public.is_admin() then
    if new.client_id is distinct from old.client_id
       or new.price is distinct from old.price
       or new.email is distinct from old.email
       or new.phone is distinct from old.phone
       or new.first_name is distinct from old.first_name
       or new.last_name is distinct from old.last_name
       or new.source is distinct from old.source then
      raise exception 'Clients duerfen nur den Lead-Status aendern.';
    end if;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_before_update on public.leads;
create trigger leads_before_update
  before update on public.leads
  for each row execute function public.handle_lead_update();

-- ------------------------------------------------------------
-- 6. Row Level Security
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.leads enable row level security;

-- profiles: jeder sieht sein eigenes Profil, Admins alle
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin"
  on public.profiles for insert
  with check (public.is_admin());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- leads: Clients nur eigene (client_id = auth.uid()), Admins alles
drop policy if exists "leads_select_own_or_admin" on public.leads;
create policy "leads_select_own_or_admin"
  on public.leads for select
  using (public.is_admin() or client_id = auth.uid());

drop policy if exists "leads_insert_admin" on public.leads;
create policy "leads_insert_admin"
  on public.leads for insert
  with check (public.is_admin());

drop policy if exists "leads_update_own_or_admin" on public.leads;
create policy "leads_update_own_or_admin"
  on public.leads for update
  using (public.is_admin() or client_id = auth.uid())
  with check (public.is_admin() or client_id = auth.uid());

drop policy if exists "leads_delete_admin" on public.leads;
create policy "leads_delete_admin"
  on public.leads for delete
  using (public.is_admin());

-- ------------------------------------------------------------
-- 7. Hilfreiche Views (optional, z. B. fuer Abrechnung)
-- ------------------------------------------------------------
create or replace view public.lead_revenue_by_client as
select
  p.id as client_id,
  p.company_name,
  date_trunc('month', l.created_at) as month,
  count(*) as lead_count,
  count(*) filter (where l.status = 'qualified') as qualified_count,
  sum(l.price) as total_revenue
from public.leads l
join public.profiles p on p.id = l.client_id
group by p.id, p.company_name, date_trunc('month', l.created_at);
