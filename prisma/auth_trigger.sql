-- ============================================================================
-- Supabase Auth → coordinators provisioning trigger
-- Run in Supabase SQL editor (or: npx prisma db execute --file prisma/auth_trigger.sql)
--
-- When a user signs up with role=COORDINATOR/TPO in app_metadata (set by the
-- backend via service role BEFORE the account is usable), this creates the
-- matching `coordinators` row. Student rows are created by the backend on
-- registration (they need profile data from the Excel import).
-- ============================================================================

create or replace function public.handle_new_coordinator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only provision elevated roles; students are provisioned by the backend
  -- (their profile needs Excel-imported data).
  if (new.raw_app_meta_data ->> 'role') in ('COORDINATOR', 'TPO') then
    insert into public.coordinators (id, name, email, role, is_active, "createdAt", "updatedAt")
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
      new.email,
      (new.raw_app_meta_data ->> 'role')::public."UserRole",
      true,
      now(),
      now()
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_coordinator();
