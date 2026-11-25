-- =============================================================================
-- Traveling · fase 5: finanzas del Equipo 2
-- =============================================================================

-- Presupuesto opcional: NULL = el viaje no tiene presupuesto definido.
alter table public.grupos_viaje
  alter column presupuesto_total drop not null,
  drop constraint grupos_viaje_presupuesto_total_check,
  add constraint grupos_viaje_presupuesto_total_check check (
    presupuesto_total is null
    or (presupuesto_total > 0 and presupuesto_total <= 9999999999.99)
  );

-- Presupuesto planeado por categoría (para comparar lo planeado con lo gastado).
create table public.budget_categories (
  group_id        bigint not null references public.grupos_viaje (id) on delete cascade,
  category        text not null,
  planned_amount  numeric(12, 2) not null check (planned_amount > 0 and planned_amount <= 9999999999.99),
  updated_at      timestamptz not null default now(),
  primary key (group_id, category),
  constraint budget_categories_category_chk
    check (category in ('transporte', 'hospedaje', 'actividad', 'comida', 'otro'))
);

alter table public.budget_categories enable row level security;

-- Comprobantes y archivos del viaje: bucket privado. El backend entrega URLs firmadas
-- temporales, así que ya no se guarda una URL fija en la tabla.
update storage.buckets set public = false where id = 'trip-documents';

alter table public.trip_documents alter column file_url drop not null;
update public.trip_documents set file_url = null;

-- Los enlaces de contexto pertenecen al viaje: si se borra la cuenta de quien los creó,
-- el enlace se conserva sin autor.
alter table public.trip_context_links
  alter column created_by_user_id drop not null,
  drop constraint trip_context_links_created_by_user_id_fkey,
  add constraint trip_context_links_created_by_user_id_fkey
    foreign key (created_by_user_id) references public.usuarios (id_usuario) on delete set null;
