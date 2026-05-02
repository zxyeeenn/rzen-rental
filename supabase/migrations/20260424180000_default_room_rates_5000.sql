-- Default listing rent: ₱5,000 per room; ₱3,500 for unit-07 (Room 7).
-- Sync active lease rent and advance/deposit multiples to match listing rates.

update public.rooms
set
  monthly_rent_php = case
    when slug = 'unit-07' then 3500
    else 5000
  end,
  updated_at = now();

update public.leases l
set
  monthly_rent_php = r.monthly_rent_php,
  advance_paid_php = r.monthly_rent_php * l.advance_months,
  deposit_held_php = r.monthly_rent_php * l.deposit_months,
  updated_at = now()
from
  public.rooms r
where
  l.room_id = r.id
  and l.is_active = true;
