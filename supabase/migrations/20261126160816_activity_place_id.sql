-- =============================================================================
-- Traveling · lugares de Google Places en las actividades
--
-- El estudio COCOMO cuenta Google Places como Archivo de Interfaz Externa: al
-- elegir la ubicación de una actividad, la app busca el lugar en Google y guarda
-- su identificador. Las coordenadas NO se guardan: los términos de Google Maps
-- Platform solo permiten conservar el Place ID de forma indefinida, así que el
-- mapa del itinerario las consulta al dibujarse.
--
-- `ubicacion` sigue siendo el texto visible (nombre del lugar o texto libre).
-- Aplicar ANTES de desplegar el backend que escribe `place_id`; el backend
-- anterior funciona igual con la columna nueva.
-- =============================================================================

alter table public.actividades
  add column place_id text,
  add constraint actividades_place_id_chk check (
    place_id is null
    or (
      ubicacion is not null
      and char_length(place_id) between 1 and 512
      and place_id ~ '^[A-Za-z0-9_-]+$'
    )
  );

comment on column public.actividades.place_id is
  'Place ID de Google Places del lugar elegido para la actividad (null = ubicación en texto libre).';
