-- =============================================================================
-- Traveling · reparto porcentual de gastos
--
-- El estudio COCOMO pide reglas de división equitativa, porcentual o exacta.
-- `porcentual` guarda el porcentaje de cada integrante en `expense_splits.percentage`
-- (para poder editarlo sin perder precisión) y el monto que le toca en `share`,
-- como los demás tipos. En los otros tipos `percentage` queda en null.
--
-- Aplicar ANTES de desplegar el backend que acepta `porcentual`; el backend
-- anterior funciona igual con el esquema nuevo.
-- =============================================================================

alter table public.expenses
  drop constraint expenses_split_type_chk,
  add constraint expenses_split_type_chk
    check (split_type in ('equitativa', 'porcentual', 'personalizada'));

alter table public.expense_splits
  add column percentage numeric(5, 2),
  add constraint expense_splits_percentage_chk
    check (percentage is null or (percentage > 0 and percentage <= 100));

comment on column public.expense_splits.percentage is
  'Porcentaje del gasto que le toca al integrante (solo reparto porcentual).';
