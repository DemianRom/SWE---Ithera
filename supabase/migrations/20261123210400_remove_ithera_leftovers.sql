-- =============================================================================
-- Traveling · fase 3: quitar restos de Ithera que el código ya no usa
--
-- Aplicar DESPUÉS de desplegar el backend de la fase 3 (el anterior todavía escribe
-- las columnas destino_* y punto_partida_* al crear o editar un viaje).
-- =============================================================================

-- Destino con Google Places y punto de partida (traslados): el destino queda como texto.
alter table public.grupos_viaje
  drop column destino_latitud,
  drop column destino_longitud,
  drop column destino_place_id,
  drop column destino_formatted_address,
  drop column destino_photo_name,
  drop column destino_photo_url,
  drop column punto_partida_tipo,
  drop column punto_partida_nombre,
  drop column punto_partida_direccion,
  drop column punto_partida_latitud,
  drop column punto_partida_longitud,
  drop column punto_partida_place_id,
  drop column punto_partida_hospedaje_id,
  drop column punto_partida_propuesta_id,
  drop column punto_partida_actualizado_at;

-- Enlaces de contexto: sin actividades de subgrupo (agendas individuales fuera de alcance).
delete from public.trip_context_links
where entity_a_type = 'subgroup_activity' or entity_b_type = 'subgroup_activity';

alter table public.trip_context_links
  drop constraint trip_context_links_entity_types_chk,
  add constraint trip_context_links_entity_types_chk check (
    entity_a_type in ('expense', 'document', 'activity')
    and entity_b_type in ('expense', 'document', 'activity')
  );

-- Preferencias de notificación de módulos del Equipo 1.
alter table public.usuario_preferencias_notificacion
  drop column notificaciones_votos,
  drop column notificaciones_comentarios,
  drop column notificaciones_vuelos,
  drop column notificaciones_hospedajes;
