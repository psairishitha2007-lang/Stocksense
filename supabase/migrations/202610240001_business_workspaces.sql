create table if not exists public.business_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  application_data jsonb not null,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_workspaces_data_is_object check (jsonb_typeof(application_data) = 'object')
);

alter table public.business_workspaces enable row level security;
revoke all on public.business_workspaces from anon;
grant select, insert, update on public.business_workspaces to authenticated;

drop policy if exists "Owners can read their workspace" on public.business_workspaces;
create policy "Owners can read their workspace"
  on public.business_workspaces for select
  to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "Owners can create their workspace" on public.business_workspaces;
create policy "Owners can create their workspace"
  on public.business_workspaces for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "Owners can update their workspace" on public.business_workspaces;
create policy "Owners can update their workspace"
  on public.business_workspaces for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create or replace function public.save_my_business_workspace(
  p_application_data jsonb,
  p_expected_revision integer
)
returns table (revision integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_revision integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if jsonb_typeof(p_application_data) is distinct from 'object' then
    raise exception 'Workspace data must be a JSON object';
  end if;

  if p_expected_revision = 0 then
    insert into public.business_workspaces (owner_id, application_data)
    values (auth.uid(), p_application_data)
    on conflict (owner_id) do nothing
    returning business_workspaces.revision into saved_revision;
  else
    update public.business_workspaces
    set application_data = p_application_data,
        revision = business_workspaces.revision + 1,
        updated_at = now()
    where owner_id = auth.uid()
      and business_workspaces.revision = p_expected_revision
    returning business_workspaces.revision into saved_revision;
  end if;

  if saved_revision is null then
    return;
  end if;

  return query select saved_revision;
end;
$$;

revoke all on function public.save_my_business_workspace(jsonb, integer) from public;
grant execute on function public.save_my_business_workspace(jsonb, integer) to authenticated;
