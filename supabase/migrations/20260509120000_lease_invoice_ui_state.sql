-- Invoice dialog progress: paid line IDs, early-unlocked months, electric draft state (synced when signed in).
alter table public.leases
add column if not exists invoice_ui_state jsonb not null default '{}'::jsonb;

comment on column public.leases.invoice_ui_state is
  'Owner invoice UI: { paidLineIds, manualUnlockedMonths, electricByMonth } — see src/lib/schemas/invoice-ui-state.ts';
