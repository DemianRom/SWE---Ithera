-- =============================================================================
-- Traveling · esquema base
--
-- Reconstruido a partir del código del backend (consultas de supabase-js) y de las
-- migraciones de Ithera que tocaban estas tablas. Solo incluye las tablas que usa
-- Traveling; las del Equipo 1 (propuestas, votos, comentarios, vuelos, hospedajes,
-- subgrupos, historial de búsquedas, checkout) no se crean.
--
-- Columnas temporales: grupos_viaje conserva destino_* (Google Places) y
-- punto_partida_* porque el código actual las escribe al crear/editar un viaje.
-- Se eliminan en la fase 3 junto con ese código (ver docs/plan-traveling.md).
--
-- Seguridad: RLS activo en todas las tablas y sin políticas. El backend usa la
-- secret key (que ignora RLS) y el frontend solo usa Supabase para autenticarse,
-- así que con la publishable key no se puede leer ni escribir ninguna tabla.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Usuarios
-- ─────────────────────────────────────────────────────────────────────────────
create table public.usuarios (
  id_usuario      bigint generated always as identity primary key,
  auth_user_id    uuid not null unique references auth.users (id) on delete cascade,
  email           text not null default '',
  nombre          text not null default 'Sin nombre',
  proveedor_auth  text not null default 'email',
  avatar_url      text,
  created_at      timestamptz not null default now()
);

create index idx_usuarios_email on public.usuarios (lower(email));

create table public.usuario_preferencias_notificacion (
  usuario_id                   bigint primary key references public.usuarios (id_usuario) on delete cascade,
  notificaciones_correo        boolean not null default true,
  notificaciones_grupo         boolean not null default true,
  notificaciones_votos         boolean not null default true,
  notificaciones_comentarios   boolean not null default true,
  notificaciones_invitaciones  boolean not null default true,
  notificaciones_finanzas      boolean not null default true,
  notificaciones_vuelos        boolean not null default true,
  notificaciones_hospedajes    boolean not null default true,
  notificaciones_alertas       boolean not null default true,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Viajes (grupos) e integrantes
-- ─────────────────────────────────────────────────────────────────────────────
create table public.grupos_viaje (
  id                            bigint generated always as identity primary key,
  nombre                        text not null,
  descripcion                   text,
  destino                       text,
  fecha_inicio                  date,
  fecha_fin                     date,
  maximo_miembros               integer,
  es_publico                    boolean not null default false,
  codigo_invitacion             text not null unique,
  creado_por                    bigint references public.usuarios (id_usuario) on delete set null,
  estado                        text not null default 'activo',
  presupuesto_total             numeric(12, 2) not null,
  modulo_itinerario_bloqueado   boolean not null default false,
  modulo_presupuesto_bloqueado  boolean not null default false,
  created_at                    timestamptz not null default now(),

  -- Temporales (Google Places y punto de partida): se eliminan en la fase 3.
  destino_latitud               double precision,
  destino_longitud              double precision,
  destino_place_id              text,
  destino_formatted_address     text,
  destino_photo_name            text,
  destino_photo_url             text,
  punto_partida_tipo            text,
  punto_partida_nombre          text,
  punto_partida_direccion       text,
  punto_partida_latitud         double precision,
  punto_partida_longitud        double precision,
  punto_partida_place_id        text,
  punto_partida_hospedaje_id    bigint,
  punto_partida_propuesta_id    bigint,
  punto_partida_actualizado_at  timestamptz,

  constraint grupos_viaje_estado_chk
    check (estado in ('activo', 'borrador', 'finalizado', 'cerrado', 'archivado')),
  constraint grupos_viaje_nombre_length_chk
    check (char_length(btrim(nombre)) between 1 and 60),
  constraint grupos_viaje_descripcion_length_chk
    check (descripcion is null or char_length(btrim(descripcion)) <= 300),
  constraint grupos_viaje_maximo_miembros_chk
    check (maximo_miembros is null or maximo_miembros between 1 and 50),
  constraint grupos_viaje_fechas_chk
    check (fecha_inicio is null or fecha_fin is null or fecha_fin >= fecha_inicio),
  constraint grupos_viaje_presupuesto_total_check
    check (presupuesto_total > 0 and presupuesto_total <= 9999999999.99)
);

create index idx_grupos_viaje_creado_por on public.grupos_viaje (creado_por);
create index idx_grupos_viaje_estado on public.grupos_viaje (estado);
create unique index ux_grupos_viaje_creador_nombre_activo
  on public.grupos_viaje (creado_por, lower(regexp_replace(btrim(nombre), '\s+', ' ', 'g')))
  where estado in ('activo', 'borrador');

create table public.grupo_miembros (
  id          bigint generated always as identity primary key,
  grupo_id    bigint not null references public.grupos_viaje (id) on delete cascade,
  usuario_id  bigint not null references public.usuarios (id_usuario) on delete cascade,
  rol         text not null default 'viajero',
  joined_at   timestamptz not null default now(),
  constraint grupo_miembros_rol_chk check (rol in ('admin', 'viajero')),
  constraint grupo_miembros_grupo_usuario_key unique (grupo_id, usuario_id)
);

create index idx_grupo_miembros_usuario_id on public.grupo_miembros (usuario_id);
-- Un solo admin por viaje.
create unique index ux_grupo_miembros_single_admin
  on public.grupo_miembros (grupo_id)
  where rol = 'admin';

create table public.grupo_invitaciones (
  id                 bigint generated always as identity primary key,
  grupo_id           bigint not null references public.grupos_viaje (id) on delete cascade,
  email              text not null,
  codigo_invitacion  text not null,
  token              text not null unique,
  estado             text not null default 'pendiente',
  creada_por         bigint references public.usuarios (id_usuario) on delete set null,
  accepted_by        bigint references public.usuarios (id_usuario) on delete set null,
  accepted_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint grupo_invitaciones_estado_chk
    check (estado in ('pendiente', 'aceptada', 'revocada', 'expirada'))
);

create index idx_grupo_invitaciones_grupo_email on public.grupo_invitaciones (grupo_id, email, estado);
create index idx_grupo_invitaciones_creada_por on public.grupo_invitaciones (creada_por);
create index idx_grupo_invitaciones_accepted_by on public.grupo_invitaciones (accepted_by);

create table public.grupo_solicitudes_union (
  id                 bigint generated always as identity primary key,
  grupo_id           bigint not null references public.grupos_viaje (id) on delete cascade,
  usuario_id         bigint not null references public.usuarios (id_usuario) on delete cascade,
  codigo_invitacion  text not null,
  estado             text not null default 'pendiente',
  mensaje            text,
  resuelta_por       bigint references public.usuarios (id_usuario) on delete set null,
  resolved_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint grupo_solicitudes_union_estado_chk
    check (estado in ('pendiente', 'aprobada', 'rechazada', 'cancelada'))
);

create index idx_grupo_solicitudes_union_grupo_estado
  on public.grupo_solicitudes_union (grupo_id, estado, created_at);
create index idx_grupo_solicitudes_union_usuario
  on public.grupo_solicitudes_union (usuario_id, created_at);
create index idx_grupo_solicitudes_resuelta_por
  on public.grupo_solicitudes_union (resuelta_por);
-- Solo una solicitud pendiente por persona y viaje (se puede volver a solicitar después).
create unique index ux_grupo_solicitudes_union_pending
  on public.grupo_solicitudes_union (grupo_id, usuario_id)
  where estado = 'pendiente';

create table public.admin_delegation_requests (
  id            bigint generated always as identity primary key,
  group_id      bigint not null references public.grupos_viaje (id) on delete cascade,
  from_user_id  bigint not null references public.usuarios (id_usuario) on delete cascade,
  to_user_id    bigint not null references public.usuarios (id_usuario) on delete cascade,
  status        text not null default 'pendiente',
  expires_at    timestamptz not null,
  responded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint admin_delegation_status_chk
    check (status in ('pendiente', 'aceptada', 'rechazada', 'expirada', 'cancelada')),
  constraint admin_delegation_different_users check (from_user_id <> to_user_id)
);

create unique index admin_delegation_one_pending_per_group_idx
  on public.admin_delegation_requests (group_id)
  where status = 'pendiente';
create index admin_delegation_target_pending_idx
  on public.admin_delegation_requests (to_user_id, status, expires_at);
create index admin_delegation_group_status_idx
  on public.admin_delegation_requests (group_id, status, created_at desc);
create index admin_delegation_from_user_idx
  on public.admin_delegation_requests (from_user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Itinerario básico
-- ─────────────────────────────────────────────────────────────────────────────
create table public.itinerarios (
  id_itinerario         bigint generated always as identity primary key,
  grupo_id              bigint not null references public.grupos_viaje (id) on delete cascade,
  nombre                text not null,
  descripcion           text,
  fecha_inicio          date,
  fecha_fin             date,
  estado                text not null default 'activo',
  creado_por            bigint references public.usuarios (id_usuario) on delete set null,
  fecha_creacion        timestamptz not null default now(),
  ultima_actualizacion  timestamptz not null default now()
);

create index idx_itinerarios_grupo_id on public.itinerarios (grupo_id);
create index idx_itinerarios_creado_por on public.itinerarios (creado_por);

create table public.actividades (
  id_actividad          bigint generated always as identity primary key,
  itinerario_id         bigint not null references public.itinerarios (id_itinerario) on delete cascade,
  titulo                text not null,
  descripcion           text,
  ubicacion             text,
  latitud               double precision,
  longitud              double precision,
  fecha_inicio          timestamptz,
  fecha_fin             timestamptz,
  estado                text not null default 'confirmada',
  creado_por            bigint references public.usuarios (id_usuario) on delete set null,
  referencia_externa    text,
  fuente                text,
  payload               jsonb not null default '{}'::jsonb,
  fecha_creacion        timestamptz not null default now(),
  ultima_actualizacion  timestamptz not null default now(),
  constraint actividades_estado_chk check (estado in ('pendiente', 'confirmada', 'cancelada')),
  constraint actividades_fechas_chk
    check (fecha_inicio is null or fecha_fin is null or fecha_fin >= fecha_inicio)
);

create index idx_actividades_itinerario_inicio on public.actividades (itinerario_id, fecha_inicio);
create index idx_actividades_creado_por on public.actividades (creado_por);

-- ─────────────────────────────────────────────────────────────────────────────
-- Gastos, repartos y pagos entre integrantes
-- ─────────────────────────────────────────────────────────────────────────────
create table public.expenses (
  id                  bigint generated always as identity primary key,
  group_id            bigint not null references public.grupos_viaje (id) on delete cascade,
  paid_by_user_id     bigint not null references public.usuarios (id_usuario),
  created_by_user_id  bigint not null references public.usuarios (id_usuario),
  amount              numeric(12, 2) not null check (amount > 0),
  description         text not null,
  category            text not null,
  split_type          text not null default 'equitativa',
  expense_date        date not null default current_date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint expenses_category_chk
    check (category in ('transporte', 'hospedaje', 'actividad', 'comida', 'otro')),
  constraint expenses_split_type_chk
    check (split_type in ('equitativa', 'personalizada'))
);

create index idx_expenses_group_date on public.expenses (group_id, expense_date desc);
create index idx_expenses_group_creator on public.expenses (group_id, created_by_user_id);
create index idx_expenses_paid_by_user_id on public.expenses (paid_by_user_id);
create index idx_expenses_created_by_user_id on public.expenses (created_by_user_id);

create table public.expense_splits (
  id          bigint generated always as identity primary key,
  expense_id  bigint not null references public.expenses (id) on delete cascade,
  user_id     bigint not null references public.usuarios (id_usuario),
  share       numeric(12, 2) not null check (share >= 0),
  settled     boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint expense_splits_expense_user_key unique (expense_id, user_id)
);

create index idx_expense_splits_user_id on public.expense_splits (user_id);

-- Flujo: el deudor registra el pago (pendiente_validacion), el acreedor lo confirma o
-- rechaza; solo los pagos confirmados reducen los saldos pendientes.
create table public.settlement_payments (
  id                   bigint generated always as identity primary key,
  group_id             bigint not null references public.grupos_viaje (id) on delete cascade,
  from_user_id         bigint not null references public.usuarios (id_usuario),
  to_user_id           bigint not null references public.usuarios (id_usuario),
  amount               numeric(12, 2) not null check (amount > 0),
  status               text not null default 'pendiente_validacion',
  payment_method       text,
  note                 text,
  paid_at              timestamptz not null default now(),
  created_by_user_id   bigint not null references public.usuarios (id_usuario),
  reviewed_by_user_id  bigint references public.usuarios (id_usuario),
  reviewed_at          timestamptz,
  rejection_reason     text,
  created_at           timestamptz not null default now(),
  constraint settlement_payments_status_check
    check (status in ('pendiente_validacion', 'confirmado', 'rechazado')),
  constraint settlement_payments_payment_method_check
    check (payment_method is null or payment_method in ('efectivo_presencial', 'transferencia')),
  constraint settlement_payments_different_users check (from_user_id <> to_user_id)
);

create index idx_settlement_payments_group_paid_at on public.settlement_payments (group_id, paid_at desc);
create index idx_settlement_payments_pair on public.settlement_payments (group_id, from_user_id, to_user_id);
create index idx_settlement_payments_from_user on public.settlement_payments (from_user_id);
create index idx_settlement_payments_to_user on public.settlement_payments (to_user_id);
create index idx_settlement_payments_created_by on public.settlement_payments (created_by_user_id);
create index idx_settlement_payments_reviewed_by on public.settlement_payments (reviewed_by_user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Archivos del viaje y comprobantes
-- ─────────────────────────────────────────────────────────────────────────────
create table public.trip_documents (
  id          uuid primary key default gen_random_uuid(),
  trip_id     bigint not null references public.grupos_viaje (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  file_name   varchar(512) not null,
  file_path   varchar(1024) not null,  -- ruta dentro del bucket trip-documents
  file_url    text not null,
  mime_type   varchar(128),
  file_size   bigint,
  category    varchar(64) not null default 'otro',
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index idx_trip_documents_trip_created on public.trip_documents (trip_id, created_at desc);
create index idx_trip_documents_user_id on public.trip_documents (user_id);

create table public.settlement_payment_documents (
  id                     bigint generated always as identity primary key,
  settlement_payment_id  bigint not null references public.settlement_payments (id) on delete cascade,
  trip_document_id       uuid not null references public.trip_documents (id) on delete cascade,
  created_at             timestamptz not null default now(),
  constraint settlement_payment_documents_key unique (settlement_payment_id, trip_document_id)
);

create index idx_settlement_payment_documents_document
  on public.settlement_payment_documents (trip_document_id);

-- Enlaces genéricos entre gastos, documentos y actividades (p. ej. comprobante de un gasto).
create table public.trip_context_links (
  id                  bigint generated always as identity primary key,
  group_id            bigint not null references public.grupos_viaje (id) on delete cascade,
  entity_a_type       text not null,
  entity_a_id         text not null,
  entity_b_type       text not null,
  entity_b_id         text not null,
  created_by_user_id  bigint not null references public.usuarios (id_usuario),
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint trip_context_links_entity_types_chk check (
    entity_a_type in ('expense', 'document', 'activity', 'subgroup_activity')
    and entity_b_type in ('expense', 'document', 'activity', 'subgroup_activity')
  ),
  constraint trip_context_links_not_self_chk
    check (entity_a_type <> entity_b_type or entity_a_id <> entity_b_id)
);

create unique index trip_context_links_unique_pair_idx
  on public.trip_context_links (group_id, entity_a_type, entity_a_id, entity_b_type, entity_b_id);
create index trip_context_links_entity_a_idx
  on public.trip_context_links (group_id, entity_a_type, entity_a_id);
create index trip_context_links_entity_b_idx
  on public.trip_context_links (group_id, entity_b_type, entity_b_id);
create index idx_trip_context_links_created_by
  on public.trip_context_links (created_by_user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Notificaciones y chat
-- ─────────────────────────────────────────────────────────────────────────────
create table public.notificaciones (
  id            bigint generated always as identity primary key,
  usuario_id    bigint not null references public.usuarios (id_usuario) on delete cascade,
  grupo_id      bigint references public.grupos_viaje (id) on delete cascade,
  tipo          text not null,
  titulo        text not null,
  mensaje       text not null,
  entidad_tipo  text,
  entidad_id    bigint,
  metadata      jsonb not null default '{}'::jsonb,
  leida         boolean not null default false,
  created_at    timestamptz not null default now()
);

create index idx_notificaciones_usuario_created_at on public.notificaciones (usuario_id, created_at desc);
create index idx_notificaciones_usuario_leida on public.notificaciones (usuario_id, leida);
create index idx_notificaciones_grupo_created_at
  on public.notificaciones (grupo_id, created_at desc)
  where grupo_id is not null;

create table public.chat_mensajes (
  id          bigint generated always as identity primary key,
  grupo_id    bigint not null references public.grupos_viaje (id) on delete cascade,
  usuario_id  bigint not null references public.usuarios (id_usuario) on delete cascade,
  contenido   text not null check (char_length(trim(contenido)) > 0 and char_length(contenido) <= 1000),
  created_at  timestamptz not null default now()
);

create index idx_chat_mensajes_grupo_created_at on public.chat_mensajes (grupo_id, created_at desc);
create index idx_chat_mensajes_usuario on public.chat_mensajes (usuario_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: activo en todo, sin políticas (solo el backend con la secret key accede)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.usuarios                          enable row level security;
alter table public.usuario_preferencias_notificacion enable row level security;
alter table public.grupos_viaje                      enable row level security;
alter table public.grupo_miembros                    enable row level security;
alter table public.grupo_invitaciones                enable row level security;
alter table public.grupo_solicitudes_union           enable row level security;
alter table public.admin_delegation_requests         enable row level security;
alter table public.itinerarios                       enable row level security;
alter table public.actividades                       enable row level security;
alter table public.expenses                          enable row level security;
alter table public.expense_splits                    enable row level security;
alter table public.settlement_payments               enable row level security;
alter table public.trip_documents                    enable row level security;
alter table public.settlement_payment_documents      enable row level security;
alter table public.trip_context_links                enable row level security;
alter table public.notificaciones                    enable row level security;
alter table public.chat_mensajes                     enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage
-- Públicos por ahora porque el backend guarda URLs públicas. En la fase 5
-- trip-documents pasa a privado con URLs firmadas (los comprobantes son sensibles).
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('trip-documents',  'trip-documents',  true, 10485760),  -- 10 MiB
  ('profile-avatars', 'profile-avatars', true, 5242880),   -- 5 MiB
  ('public-assets',   'public-assets',   true, 5242880)
on conflict (id) do nothing;
