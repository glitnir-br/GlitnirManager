alter table public.player_item_deliveries
  alter column quality drop not null;

notify pgrst, 'reload schema';
