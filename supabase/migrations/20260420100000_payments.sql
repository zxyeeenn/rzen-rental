create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  amount_php numeric(12, 2) not null check (amount_php > 0),
  billing_month text not null,
  due_date date not null,
  paid_date date,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_room_id_idx on public.payments (room_id);
create index if not exists payments_status_idx on public.payments (status);
create index if not exists payments_billing_month_idx on public.payments (billing_month);

alter table public.payments enable row level security;

create policy "payments_select_authenticated" on public.payments for
select to authenticated using (true);

create policy "payments_insert_authenticated" on public.payments for
insert to authenticated
with
  check (true);

create policy "payments_update_authenticated" on public.payments for
update to authenticated using (true)
with
  check (true);

create policy "payments_delete_authenticated" on public.payments for delete to authenticated using (true);

insert into public.payments (
  room_id,
  amount_php,
  billing_month,
  due_date,
  paid_date,
  status,
  notes
)
select
  r.id,
  l.monthly_rent_php,
  to_char(current_date, 'YYYY-MM'),
  make_date(
    extract(year from current_date)::int,
    extract(month from current_date)::int,
    l.rent_due_day
  ),
  null,
  'pending',
  'Auto-seeded from active lease'
from
  public.rooms r
  join public.leases l on l.room_id = r.id
where
  l.is_active = true
  and not exists (
    select 1
    from public.payments p
    where p.room_id = r.id
      and p.billing_month = to_char(current_date, 'YYYY-MM')
  );
