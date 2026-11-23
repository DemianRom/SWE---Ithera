import { supabase } from "../../infrastructure/db/supabase.client";
import { getLocalUserId } from "../groups/groups.service";
import * as NotificationsService from "../notifications/notifications.service";
import {
  ActivityPayload,
  ItineraryActivity,
  ItineraryDay,
} from "./itinerary.entity";

// Itinerario básico: cualquier integrante agrega actividades (ya confirmadas, sin
// votación); solo quien la creó o un admin puede editarla o eliminarla.

const TIME_ZONE = "America/Mexico_City";
const READ_ONLY_GROUP_STATES = new Set(["cerrado", "archivado", "finalizado"]);
const DEFAULT_ACTIVITY_IMAGE =
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&h=300&fit=crop";

const TITLE_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 500;
const LOCATION_MAX_LENGTH = 200;

const ACTIVITY_COLUMNS =
  "id_actividad, itinerario_id, titulo, descripcion, ubicacion, fecha_inicio, fecha_fin, estado, creado_por";

type ServiceError = Error & { statusCode?: number };

const createError = (message: string, statusCode: number): ServiceError =>
  Object.assign(new Error(message), { statusCode });

type ActivityRow = {
  id_actividad: number | string;
  itinerario_id: number | string;
  titulo: string;
  descripcion: string | null;
  ubicacion: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: string | null;
  creado_por: number | string | null;
};

type GroupRow = {
  id: number | string;
  nombre: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: string | null;
  modulo_itinerario_bloqueado: boolean | null;
};

// ── Fechas ───────────────────────────────────────────────────────────────────

const dateOnlyInTimeZone = (date: Date): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
};

const getTodayDateOnly = (): string => dateOnlyInTimeZone(new Date());

const getDateOnly = (value?: string | null): string | null => {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10) || null;
  return dateOnlyInTimeZone(parsed);
};

const formatDateLabel = (date: string): string =>
  new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));

const formatTimeLabel = (value?: string | null): string => {
  if (!value) return "Hora pendiente";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Hora pendiente";
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
};

const diffDays = (startDate: string, currentDate: string): number => {
  const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const current = new Date(`${currentDate}T00:00:00.000Z`).getTime();
  return Math.floor((current - start) / 86_400_000);
};

const addDays = (dateValue: string, days: number): string => {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const minuteInTimeZone = (value: string): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    minute: "2-digit",
  }).formatToParts(new Date(value));
  return parts.find((part) => part.type === "minute")?.value.padStart(2, "0") ?? "00";
};

// ── Validaciones ─────────────────────────────────────────────────────────────

const normalizeText = (
  value: unknown,
  label: string,
  maxLength: number,
  required: boolean,
): string | null => {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    if (required) throw createError(`${label} es obligatorio.`, 400);
    return null;
  }
  if (text.length > maxLength) {
    throw createError(`${label} permite máximo ${maxLength} caracteres.`, 400);
  }
  return text;
};

const normalizeDateTime = (value: unknown, label: string, required: boolean): string | null => {
  if (value === null || value === undefined || value === "") {
    if (required) throw createError(`${label} es obligatoria.`, 400);
    return null;
  }
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw createError(`${label} no es una fecha y hora válida.`, 400);
  }
  return parsed.toISOString();
};

const assertScheduleIsValid = (
  startsAt: string,
  endsAt: string | null,
  group: GroupRow,
): void => {
  const activityDate = getDateOnly(startsAt)!;
  const tripStart = getDateOnly(group.fecha_inicio);
  const tripEnd = getDateOnly(group.fecha_fin ?? group.fecha_inicio);

  if (tripStart && activityDate < tripStart) {
    throw createError("La actividad no puede programarse antes del inicio del viaje.", 400);
  }
  if (tripEnd && activityDate > tripEnd) {
    throw createError("La actividad no puede programarse después del fin del viaje.", 400);
  }
  if (activityDate < getTodayDateOnly()) {
    throw createError("No puedes agregar ni modificar actividades en días anteriores al actual.", 400);
  }
  for (const [value, label] of [[startsAt, "inicio"], [endsAt, "fin"]] as const) {
    if (value && !["00", "30"].includes(minuteInTimeZone(value))) {
      throw createError(`La hora de ${label} debe estar en intervalos de 30 minutos.`, 400);
    }
  }
  if (endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    throw createError("La hora de fin debe ser posterior a la de inicio.", 400);
  }
};

const assertNoOverlap = async (
  itineraryId: string | number,
  startsAt: string,
  endsAt: string | null,
  excludeActivityId?: string,
): Promise<void> => {
  const { data, error } = await supabase
    .from("actividades")
    .select("id_actividad, titulo, fecha_inicio, fecha_fin, estado")
    .eq("itinerario_id", itineraryId)
    .neq("estado", "cancelada");
  if (error) throw new Error(error.message);

  const start = new Date(startsAt).getTime();
  // Una actividad sin hora de fin ocupa un instante; se trata como un minuto.
  const end = endsAt ? new Date(endsAt).getTime() : start + 60_000;

  const conflict = (data ?? []).find((row: any) => {
    if (excludeActivityId && String(row.id_actividad) === excludeActivityId) return false;
    if (!row.fecha_inicio) return false;
    const otherStart = new Date(row.fecha_inicio).getTime();
    const otherEnd = row.fecha_fin ? new Date(row.fecha_fin).getTime() : otherStart + 60_000;
    return start < otherEnd && otherStart < end;
  });

  if (conflict) {
    throw createError(
      `Ya hay una actividad en ese horario: "${String((conflict as any).titulo ?? "Actividad")}".`,
      409,
    );
  }
};

// ── Contexto del viaje ───────────────────────────────────────────────────────

const getMembershipContext = async (authUserId: string, groupId: string) => {
  const usuarioId = await getLocalUserId(authUserId);

  const { data: membership, error: membershipError } = await supabase
    .from("grupo_miembros")
    .select("rol")
    .eq("grupo_id", groupId)
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  if (membershipError) throw new Error(membershipError.message);
  if (!membership) throw createError("No perteneces a este viaje.", 403);

  const { data: group, error: groupError } = await supabase
    .from("grupos_viaje")
    .select("id, nombre, fecha_inicio, fecha_fin, estado, modulo_itinerario_bloqueado")
    .eq("id", groupId)
    .maybeSingle();
  if (groupError) throw new Error(groupError.message);
  if (!group) throw createError("Viaje no encontrado.", 404);

  return {
    usuarioId: String(usuarioId),
    isAdmin: String((membership as any).rol) === "admin",
    group: group as GroupRow,
  };
};

const assertItineraryIsEditable = (group: GroupRow): void => {
  if (READ_ONLY_GROUP_STATES.has(String(group.estado ?? "").toLowerCase())) {
    throw createError("El viaje está cerrado; el itinerario es de solo lectura.", 409);
  }
  if (group.modulo_itinerario_bloqueado) {
    throw createError("El organizador bloqueó cambios en el itinerario.", 423);
  }
};

const getOrCreateItinerary = async (group: GroupRow, usuarioId: string) => {
  const { data: existing, error } = await supabase
    .from("itinerarios")
    .select("id_itinerario")
    .eq("grupo_id", group.id)
    .order("fecha_creacion", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (existing) return String((existing as any).id_itinerario);

  const { data: created, error: createError_ } = await supabase
    .from("itinerarios")
    .insert({
      grupo_id: Number(group.id),
      nombre: `Itinerario de ${group.nombre}`,
      fecha_inicio: group.fecha_inicio,
      fecha_fin: group.fecha_fin,
      estado: "activo",
      creado_por: Number(usuarioId),
    })
    .select("id_itinerario")
    .single();
  if (createError_ || !created) {
    throw new Error(createError_?.message ?? "No se pudo crear el itinerario.");
  }
  return String((created as any).id_itinerario);
};

const assertActivityId = (activityId: string): void => {
  if (!/^\d+$/.test(activityId)) throw createError("Actividad no encontrada.", 404);
};

const getActivityInGroup = async (groupId: string, activityId: string): Promise<ActivityRow> => {
  assertActivityId(activityId);
  const { data, error } = await supabase
    .from("actividades")
    .select(`${ACTIVITY_COLUMNS}, itinerarios!inner(grupo_id)`)
    .eq("id_actividad", activityId)
    .eq("itinerarios.grupo_id", groupId)
    .neq("estado", "cancelada")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw createError("Actividad no encontrada.", 404);
  return data as unknown as ActivityRow;
};

const assertCanManageActivity = (
  activity: ActivityRow,
  ctx: { usuarioId: string; isAdmin: boolean },
): void => {
  if (!ctx.isAdmin && String(activity.creado_por ?? "") !== ctx.usuarioId) {
    throw createError("Solo quien creó la actividad o un admin del viaje puede modificarla.", 403);
  }
};

const getUserNames = async (userIds: string[]): Promise<Map<string, string>> => {
  if (userIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("usuarios")
    .select("id_usuario, nombre, email")
    .in("id_usuario", userIds);
  if (error) throw new Error(error.message);
  return new Map(
    (data ?? []).map((user: any) => [
      String(user.id_usuario),
      String(user.nombre || user.email || "Integrante"),
    ]),
  );
};

const mapActivity = (row: ActivityRow, names: Map<string, string>): ItineraryActivity => {
  const createdBy = row.creado_por !== null && row.creado_por !== undefined ? String(row.creado_por) : null;
  return {
    id: String(row.id_actividad),
    title: row.titulo,
    description: row.descripcion ?? "",
    location: row.ubicacion ?? undefined,
    time: formatTimeLabel(row.fecha_inicio),
    startsAt: row.fecha_inicio,
    endsAt: row.fecha_fin,
    status: "confirmada",
    createdBy,
    createdByName: createdBy ? (names.get(createdBy) ?? null) : null,
    category: "actividad",
    price: 0,
    currency: "MXN",
    image: DEFAULT_ACTIVITY_IMAGE,
  };
};

const emitItineraryChange = (
  groupId: string,
  tipo: string,
  activityId: string,
  actorUsuarioId: string,
  title?: string,
) => {
  NotificationsService.emitGroupDashboardUpdated(Number(groupId), {
    tipo,
    entidadTipo: "actividad",
    entidadId: Number(activityId),
    actorUsuarioId: Number(actorUsuarioId),
    metadata: { itemType: "actividad", ...(title ? { itemTitle: title } : {}) },
  });
};

// ── API del servicio ─────────────────────────────────────────────────────────

export const getGroupItinerary = async (
  authUserId: string,
  groupId: string,
): Promise<{ itinerary: { id: string } | null; days: ItineraryDay[] }> => {
  const { group } = await getMembershipContext(authUserId, groupId);

  const { data: itineraries, error: itinerariesError } = await supabase
    .from("itinerarios")
    .select("id_itinerario")
    .eq("grupo_id", groupId)
    .order("fecha_creacion", { ascending: true });
  if (itinerariesError) throw new Error(itinerariesError.message);
  const itineraryIds = (itineraries ?? []).map((item: any) => item.id_itinerario);

  let rows: ActivityRow[] = [];
  if (itineraryIds.length > 0) {
    const { data, error } = await supabase
      .from("actividades")
      .select(ACTIVITY_COLUMNS)
      .in("itinerario_id", itineraryIds)
      .neq("estado", "cancelada")
      .order("fecha_inicio", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    rows = (data ?? []) as ActivityRow[];
  }

  // Días del viaje; si alguna actividad quedó fuera del rango (p. ej. tras cambiar las
  // fechas), el rango se amplía para no ocultarla.
  const activityDates = rows
    .map((row) => getDateOnly(row.fecha_inicio))
    .filter((date): date is string => Boolean(date))
    .sort();
  const tripStart = getDateOnly(group.fecha_inicio) ?? activityDates[0] ?? getTodayDateOnly();
  const tripEnd = getDateOnly(group.fecha_fin) ?? activityDates[activityDates.length - 1] ?? tripStart;
  const startDate = activityDates[0] && activityDates[0] < tripStart ? activityDates[0] : tripStart;
  const lastActivity = activityDates[activityDates.length - 1];
  const endDate = lastActivity && lastActivity > tripEnd ? lastActivity : tripEnd;
  const totalDays = Math.max(1, diffDays(startDate, endDate) + 1);

  const days: ItineraryDay[] = Array.from({ length: totalDays }, (_, index) => ({
    dayNumber: index + 1,
    date: formatDateLabel(addDays(startDate, index)),
    activities: [],
  }));

  const names = await getUserNames(
    Array.from(new Set(rows.map((row) => String(row.creado_por ?? "")).filter(Boolean))),
  );

  for (const row of rows) {
    const date = getDateOnly(row.fecha_inicio);
    if (!date) continue;
    const dayIndex = diffDays(startDate, date);
    if (dayIndex < 0 || dayIndex >= days.length) continue;
    days[dayIndex].activities.push(mapActivity(row, names));
  }

  return {
    itinerary: itineraryIds.length > 0 ? { id: String(itineraryIds[0]) } : null,
    days,
  };
};

export const createGroupActivity = async (
  authUserId: string,
  groupId: string,
  payload: ActivityPayload,
): Promise<ItineraryActivity> => {
  const ctx = await getMembershipContext(authUserId, groupId);
  assertItineraryIsEditable(ctx.group);

  const titulo = normalizeText(payload.titulo, "El título", TITLE_MAX_LENGTH, true)!;
  const descripcion = normalizeText(payload.descripcion, "La descripción", DESCRIPTION_MAX_LENGTH, false);
  const ubicacion = normalizeText(payload.ubicacion, "La ubicación", LOCATION_MAX_LENGTH, false);
  const startsAt = normalizeDateTime(payload.fecha_inicio, "La fecha de inicio", true)!;
  const endsAt = normalizeDateTime(payload.fecha_fin, "La fecha de fin", false);
  assertScheduleIsValid(startsAt, endsAt, ctx.group);

  const itineraryId = await getOrCreateItinerary(ctx.group, ctx.usuarioId);
  await assertNoOverlap(itineraryId, startsAt, endsAt);

  const { data, error } = await supabase
    .from("actividades")
    .insert({
      itinerario_id: Number(itineraryId),
      titulo,
      descripcion,
      ubicacion,
      fecha_inicio: startsAt,
      fecha_fin: endsAt,
      estado: "confirmada",
      creado_por: Number(ctx.usuarioId),
    })
    .select(ACTIVITY_COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "No se pudo crear la actividad.");

  const row = data as ActivityRow;
  emitItineraryChange(groupId, "actividad_creada", String(row.id_actividad), ctx.usuarioId, titulo);
  return mapActivity(row, await getUserNames([ctx.usuarioId]));
};

export const updateGroupActivity = async (
  authUserId: string,
  groupId: string,
  activityId: string,
  payload: ActivityPayload,
): Promise<ItineraryActivity> => {
  const ctx = await getMembershipContext(authUserId, groupId);
  assertItineraryIsEditable(ctx.group);

  const current = await getActivityInGroup(groupId, activityId);
  assertCanManageActivity(current, ctx);
  if ((getDateOnly(current.fecha_inicio) ?? "9999-12-31") < getTodayDateOnly()) {
    throw createError("No puedes modificar actividades de días anteriores al actual.", 400);
  }

  const has = (key: keyof ActivityPayload) => Object.prototype.hasOwnProperty.call(payload, key);
  const titulo = has("titulo")
    ? normalizeText(payload.titulo, "El título", TITLE_MAX_LENGTH, true)!
    : current.titulo;
  const descripcion = has("descripcion")
    ? normalizeText(payload.descripcion, "La descripción", DESCRIPTION_MAX_LENGTH, false)
    : current.descripcion;
  const ubicacion = has("ubicacion")
    ? normalizeText(payload.ubicacion, "La ubicación", LOCATION_MAX_LENGTH, false)
    : current.ubicacion;
  const startsAt = has("fecha_inicio")
    ? normalizeDateTime(payload.fecha_inicio, "La fecha de inicio", true)!
    : normalizeDateTime(current.fecha_inicio, "La fecha de inicio", true)!;
  const endsAt = has("fecha_fin")
    ? normalizeDateTime(payload.fecha_fin, "La fecha de fin", false)
    : normalizeDateTime(current.fecha_fin, "La fecha de fin", false);
  assertScheduleIsValid(startsAt, endsAt, ctx.group);
  await assertNoOverlap(current.itinerario_id, startsAt, endsAt, String(current.id_actividad));

  const { data, error } = await supabase
    .from("actividades")
    .update({
      titulo,
      descripcion,
      ubicacion,
      fecha_inicio: startsAt,
      fecha_fin: endsAt,
      ultima_actualizacion: new Date().toISOString(),
    })
    .eq("id_actividad", activityId)
    .select(ACTIVITY_COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "No se pudo actualizar la actividad.");

  const row = data as ActivityRow;
  emitItineraryChange(groupId, "actividad_actualizada", activityId, ctx.usuarioId, titulo);
  return mapActivity(row, await getUserNames(row.creado_por ? [String(row.creado_por)] : []));
};

export const deleteGroupActivity = async (
  authUserId: string,
  groupId: string,
  activityId: string,
): Promise<void> => {
  const ctx = await getMembershipContext(authUserId, groupId);
  assertItineraryIsEditable(ctx.group);

  const current = await getActivityInGroup(groupId, activityId);
  assertCanManageActivity(current, ctx);
  if ((getDateOnly(current.fecha_inicio) ?? "9999-12-31") < getTodayDateOnly()) {
    throw createError("No puedes eliminar actividades de días anteriores al actual.", 400);
  }

  // Los enlaces con gastos y documentos apuntan a la actividad por texto (sin FK).
  const { error: linksError } = await supabase
    .from("trip_context_links")
    .delete()
    .eq("group_id", groupId)
    .or(
      `and(entity_a_type.eq.activity,entity_a_id.eq.${activityId}),and(entity_b_type.eq.activity,entity_b_id.eq.${activityId})`,
    );
  if (linksError) throw new Error(linksError.message);

  const { error } = await supabase.from("actividades").delete().eq("id_actividad", activityId);
  if (error) throw new Error(error.message);

  emitItineraryChange(groupId, "actividad_eliminada", activityId, ctx.usuarioId, current.titulo);
};
