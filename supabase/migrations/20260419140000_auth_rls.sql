-- Owner access via Supabase Auth (authenticated role + JWT).
-- Anon: still only vacant rooms (existing policy). Authenticated: full operational access.

create policy "rooms_select_authenticated" on public.rooms for
select to authenticated using (true);

create policy "rooms_update_authenticated" on public.rooms for
update to authenticated using (true)
with
  check (true);

create policy "leases_select_authenticated" on public.leases for
select to authenticated using (true);

create policy "leases_insert_authenticated" on public.leases for
insert to authenticated
with
  check (true);

create policy "leases_update_authenticated" on public.leases for
update to authenticated using (true)
with
  check (true);

create policy "leases_delete_authenticated" on public.leases for delete to authenticated using (true);

create policy "utility_readings_select_authenticated" on public.utility_readings for
select to authenticated using (true);

create policy "utility_readings_insert_authenticated" on public.utility_readings for
insert to authenticated
with
  check (true);

create policy "utility_readings_update_authenticated" on public.utility_readings for
update to authenticated using (true)
with
  check (true);

create policy "utility_readings_delete_authenticated" on public.utility_readings for delete to authenticated using (true);
