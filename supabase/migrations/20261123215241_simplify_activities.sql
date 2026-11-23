-- =============================================================================
-- Traveling · fase 4: itinerario básico
--
-- Las actividades se crean directamente (sin propuestas ni votación) y la ubicación
-- es texto libre (sin Google Maps). Se quitan las columnas que solo usaban las
-- propuestas y los mapas, y el estado "pendiente" (votación) deja de existir.
-- Aplicar DESPUÉS de desplegar el backend de esta fase.
-- =============================================================================

alter table public.actividades
  drop column latitud,
  drop column longitud,
  drop column referencia_externa,
  drop column fuente,
  drop column payload;

update public.actividades set estado = 'confirmada' where estado = 'pendiente';

alter table public.actividades
  drop constraint actividades_estado_chk,
  add constraint actividades_estado_chk check (estado in ('confirmada', 'cancelada'));
