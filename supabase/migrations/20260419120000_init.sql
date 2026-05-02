-- RZen Rental — core schema (run in Supabase SQL editor or via CLI)

create extension if not exists pgcrypto;

create type public.room_status as enum ('vacant', 'occupied', 'maintenance');

create type public.utility_kind as enum ('electric', 'water');

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  monthly_rent_php numeric(12, 2) not null check (monthly_rent_php > 0),
  floor_area_sqm numeric(8, 2) not null check (floor_area_sqm > 0),
  short_description text not null,
  amenities text[] not null default '{}',
  photo_urls jsonb not null default '[]'::jsonb,
  status public.room_status not null default 'vacant',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leases (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  tenant_name text not null,
  monthly_rent_php numeric(12, 2) not null check (monthly_rent_php > 0),
  advance_months int not null default 1 check (advance_months between 0 and 12),
  deposit_months int not null default 1 check (deposit_months between 0 and 12),
  rent_due_day int not null check (rent_due_day between 1 and 28),
  lease_start date not null,
  lease_end date,
  advance_paid_php numeric(12, 2) not null default 0 check (advance_paid_php >= 0),
  deposit_held_php numeric(12, 2) not null default 0 check (deposit_held_php >= 0),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index leases_one_active_per_room on public.leases (room_id)
where
  (is_active = true);

create table public.utility_readings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  kind public.utility_kind not null,
  period_start date not null,
  period_end date not null,
  previous_reading numeric(14, 4) not null,
  current_reading numeric(14, 4) not null,
  notes text,
  created_at timestamptz not null default now(),
  check (period_end >= period_start),
  check (current_reading >= previous_reading)
);

alter table public.rooms enable row level security;

alter table public.leases enable row level security;

alter table public.utility_readings enable row level security;

-- Guest listings: anonymous users may only see vacant units
create policy "rooms_select_vacant_public" on public.rooms for
select to anon using (status = 'vacant');

-- Service role bypasses RLS; owner dashboard should use the service role on the server.

-- Seed: 8 rooms (3 vacant, 4 occupied, 1 maintenance) — Bohol property
insert into public.rooms (
  id,
  slug,
  title,
  monthly_rent_php,
  floor_area_sqm,
  short_description,
  amenities,
  photo_urls,
  status,
  sort_order
)
values
  (
    'a1111111-1111-4111-8111-111111111101',
    'unit-01',
    'Garden Wing · Room 1',
    5000,
    22,
    'Ground-floor corner room with a small patio, ideal for two guests or a remote-work setup.',
    array['Wi-Fi', 'Private bath', 'Mini fridge', 'Hot shower'],
    '[
      {"src":"https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80","alt":"Bright studio living area with sofa and tall windows"},
      {"src":"https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80","alt":"Minimal bedroom with white linens and wooden headboard"},
      {"src":"https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=1200&q=80","alt":"Compact kitchenette with sink and cabinets"}
    ]'::jsonb,
    'vacant',
    1
  ),
  (
    'a1111111-1111-4111-8111-111111111102',
    'unit-02',
    'Garden Wing · Room 2',
    5000,
    20,
    'Quiet middle unit overlooking the garden — cross-ventilation and blackout curtains included.',
    array['Wi-Fi', 'Private bath', 'Desk', 'A/C'],
    '[
      {"src":"https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80","alt":"Living room with sofa and framed art"},
      {"src":"https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1200&q=80","alt":"Bed with decorative pillows and side table"},
      {"src":"https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80","alt":"Modern bathroom vanity with mirror"}
    ]'::jsonb,
    'vacant',
    2
  ),
  (
    'a1111111-1111-4111-8111-111111111103',
    'unit-03',
    'Sea Breeze Loft · Room 3',
    5000,
    26,
    'Upper-floor loft feel with higher ceilings, extra storage, and stronger afternoon breeze.',
    array['Wi-Fi', 'Private bath', 'Kitchenette', 'Balcony'],
    '[
      {"src":"https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80","alt":"Bedroom with large bed and pendant lights"},
      {"src":"https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80","alt":"Open living and dining space with plants"},
      {"src":"https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80","alt":"Staircase and loft-style interior"}
    ]'::jsonb,
    'vacant',
    3
  ),
  (
    'a1111111-1111-4111-8111-111111111104',
    'unit-04',
    'Sea Breeze Loft · Room 4',
    5000,
    24,
    'Same building as Room 3 with a slightly smaller footprint — still gets great natural light.',
    array['Wi-Fi', 'Private bath', 'A/C', 'Work nook'],
    '[
      {"src":"https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&q=80","alt":"Cozy bedroom with warm lighting"},
      {"src":"https://images.unsplash.com/photo-1615529328331-f8917597711f?auto=format&fit=crop&w=1200&q=80","alt":"Sofa and coffee table in compact lounge"},
      {"src":"https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80","alt":"Bathroom with walk-in shower glass"}
    ]'::jsonb,
    'occupied',
    4
  ),
  (
    'a1111111-1111-4111-8111-111111111105',
    'unit-05',
    'Courtyard Studio · Room 5',
    5000,
    19,
    'Efficient studio layout steps from the shared courtyard — easy laundry and bike parking.',
    array['Wi-Fi', 'Private bath', 'Laundry access', 'Fan'],
    '[
      {"src":"https://images.unsplash.com/photo-1536376072261-38c75010e6c9?auto=format&fit=crop&w=1200&q=80","alt":"Studio apartment with bed and sofa in one room"},
      {"src":"https://images.unsplash.com/photo-1556020682-ae6ab96120cc?auto=format&fit=crop&w=1200&q=80","alt":"Kitchen area with bar stools"},
      {"src":"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80","alt":"Exterior courtyard with plants"}
    ]'::jsonb,
    'occupied',
    5
  ),
  (
    'a1111111-1111-4111-8111-111111111106',
    'unit-06',
    'Courtyard Studio · Room 6',
    5000,
    21,
    'Slightly wider studio with space for a small dining table — popular with long-stay guests.',
    array['Wi-Fi', 'Private bath', 'Hot shower', 'A/C'],
    '[
      {"src":"https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=1200&q=80","alt":"Modern living room with grey sofa"},
      {"src":"https://images.unsplash.com/photo-1631679706909-1844bbd07221?auto=format&fit=crop&w=1200&q=80","alt":"Bedroom corner with wall art"},
      {"src":"https://images.unsplash.com/photo-1604014237800-1c9102b219e5?auto=format&fit=crop&w=1200&q=80","alt":"Clean white bathroom interior"}
    ]'::jsonb,
    'occupied',
    6
  ),
  (
    'a1111111-1111-4111-8111-111111111107',
    'unit-07',
    'Streetfront · Room 7',
    3500,
    18,
    'Quick access to the main road for trikes and habal-habal — good for commuters.',
    array['Wi-Fi', 'Private bath', 'Security grille', 'Desk'],
    '[
      {"src":"https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80","alt":"Contemporary room with wood accents"},
      {"src":"https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1200&q=80","alt":"Armchair and floor lamp reading corner"},
      {"src":"https://images.unsplash.com/photo-1600573472592-401b489a3cdc?auto=format&fit=crop&w=1200&q=80","alt":"Hallway with framed photos"}
    ]'::jsonb,
    'occupied',
    7
  ),
  (
    'a1111111-1111-4111-8111-111111111108',
    'unit-08',
    'Rooftop Corner · Room 8',
    5000,
    28,
    'Largest unit with panoramic rooftop access for drying laundry and sunset coffee.',
    array['Wi-Fi', 'Private bath', 'Full kitchenette', 'Rooftop access'],
    '[
      {"src":"https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1200&q=80","alt":"Spacious open plan apartment interior"},
      {"src":"https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=1200&q=80","alt":"Dining table with chairs near window"},
      {"src":"https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&q=80","alt":"Rooftop terrace with city view at dusk"}
    ]'::jsonb,
    'maintenance',
    8
  )
on conflict (slug) do nothing;

insert into public.leases (
  room_id,
  tenant_name,
  monthly_rent_php,
  advance_months,
  deposit_months,
  rent_due_day,
  lease_start,
  lease_end,
  advance_paid_php,
  deposit_held_php,
  is_active,
  notes
)
select
  v.room_id,
  v.tenant_name,
  v.monthly_rent_php,
  v.advance_months,
  v.deposit_months,
  v.rent_due_day,
  v.lease_start,
  v.lease_end,
  v.advance_paid_php,
  v.deposit_held_php,
  v.is_active,
  v.notes
from
  (
    values
      (
        'a1111111-1111-4111-8111-111111111104'::uuid,
        'Maria Santos',
        5000::numeric,
        1,
        1,
        5,
        '2025-11-01'::date,
        null::date,
        5000::numeric,
        5000::numeric,
        true,
        '1 month advance + 1 month deposit on file.'::text
      ),
      (
        'a1111111-1111-4111-8111-111111111105'::uuid,
        'James & Ana Reyes',
        5000::numeric,
        1,
        1,
        3,
        '2025-10-15'::date,
        null::date,
        5000::numeric,
        5000::numeric,
        true,
        null::text
      ),
      (
        'a1111111-1111-4111-8111-111111111106'::uuid,
        'Luis Galaroza',
        5000::numeric,
        1,
        1,
        7,
        '2026-01-05'::date,
        null::date,
        5000::numeric,
        5000::numeric,
        true,
        null::text
      ),
      (
        'a1111111-1111-4111-8111-111111111107'::uuid,
        'Remote worker — initials KL',
        3500::numeric,
        1,
        1,
        1,
        '2025-12-01'::date,
        '2026-06-30'::date,
        3500::numeric,
        3500::numeric,
        true,
        'End date tentative; renewal in discussion.'::text
      )
  )
    as v (
      room_id,
      tenant_name,
      monthly_rent_php,
      advance_months,
      deposit_months,
      rent_due_day,
      lease_start,
      lease_end,
      advance_paid_php,
      deposit_held_php,
      is_active,
      notes
    )
where
  not exists (
    select
      1
    from
      public.leases l
    where
      l.room_id = v.room_id
      and l.is_active
  );
