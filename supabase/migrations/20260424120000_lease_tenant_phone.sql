-- Optional contact on lease (matches prototype tenant capture)

alter table public.leases
add column if not exists tenant_phone text;
