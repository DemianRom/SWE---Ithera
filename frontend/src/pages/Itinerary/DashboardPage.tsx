import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  clearCurrentGroup,
  getCurrentGroup,
  groupsService,
  saveCurrentGroup,
} from "../../services/groups";
import type { ItineraryDay } from "../../services/groups";
import { useAuth } from "../../context/useAuth";
import {
  AppLayout,
  RightPanelDashboard,
  SidebarDashboard,
} from "../../components/layout/AppLayout";
import { ChatDrawer } from "../../components/chat/ChatDrawer";
import { DayView } from "../../components/ui/DayView";
import { TripMap, type TripMapActivity } from "../../components/ui/TripMap";
import { useGoogleMapsAvailable } from "../../lib/googleMaps";
import type {
  Activity as DayActivity,
  DayViewHandle,
} from "../../components/ui/DayView";
import { BudgetDashboard } from "../../components/budget/BudgetDashboard";
import { budgetService, type BudgetSummary } from "../../services/budget";
import {
  contextLinksService,
  type ContextEntityRef,
  type ContextEntitySummary,
  type ContextLink,
} from "../../services/context-links";
import { DocumentVaultPanel } from "../../components/documents/DocumentVaultPanel";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import {
  ActivityFormModal,
  type ActivityFormValues,
} from "../../components/ActivityFormModal/ActivityFormModal";
import { useSocket } from "../../hooks/useSocket";
import { useNetworkMonitor } from "../../hooks/useNetworkMonitor";
import type { Group } from "../../types/groups";

function IconDownload({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <polyline
        points="7 10 12 15 17 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="12"
        y1="15"
        x2="12"
        y2="3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPlus({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <line
        x1="12"
        y1="5"
        x2="12"
        y2="19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="5"
        y1="12"
        x2="19"
        y2="12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMapPinSmall({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 22s7-5.2 7-12a7 7 0 10-14 0c0 6.8 7 12 7 12z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.5" fill="currentColor" />
    </svg>
  );
}

function IconCalendarSmall({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="18"
        rx="3"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M8 2v4M16 2v4M3 10h18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface SwitchingGroupState {
  id?: string | number;
  nombre?: string | null;
  destino?: string | null;
  destino_formatted_address?: string | null;
  destino_photo_url?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  myRole?: string | null;
}

function DashboardSwitchLoading({
  group,
}: {
  group?: SwitchingGroupState | Group | null;
}) {
  const title = group?.nombre || "Cargando viaje";
  const destination = group?.destino || "Preparando información del destino";
  const typedGroup = group as Group | SwitchingGroupState | null | undefined;
  const startDate = typedGroup?.fecha_inicio
    ? new Date(typedGroup.fecha_inicio)
    : null;
  const endDate = typedGroup?.fecha_fin ? new Date(typedGroup.fecha_fin) : null;
  const tripDays =
    startDate && endDate
      ? Math.max(
          1,
          Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) +
            1,
        )
      : null;
  const memberCount =
    Number((typedGroup as Group | undefined)?.memberCount ?? 0) || null;
  const maxMembers =
    Number((typedGroup as Group | undefined)?.maximo_miembros ?? 0) || null;
  const totalBudgetRaw = (typedGroup as Group | undefined)?.presupuesto_total;
  const totalBudget =
    totalBudgetRaw != null && totalBudgetRaw !== ""
      ? Number(totalBudgetRaw)
      : null;
  const loadingDetails = [
    {
      label: "Itinerario",
      value:
        tripDays != null
          ? `${tripDays} dia${tripDays === 1 ? "" : "s"}`
          : "Fechas en preparacion",
      hint:
        startDate && endDate
          ? `${typedGroup?.fecha_inicio} -> ${typedGroup?.fecha_fin}`
          : "Calculando rango del viaje",
    },
    {
      label: "Participantes",
      value:
        memberCount != null && maxMembers != null
          ? `${memberCount} / ${maxMembers}`
          : memberCount != null
            ? `${memberCount} personas`
            : "Sin conteo disponible",
      hint:
        maxMembers != null
          ? "Integrantes actuales y capacidad"
          : "Cargando miembros del grupo",
    },
    {
      label: "Presupuesto",
      value:
        totalBudget != null && Number.isFinite(totalBudget)
          ? `$${totalBudget.toLocaleString("es-MX")}`
          : "Sin presupuesto",
      hint:
        totalBudget != null && Number.isFinite(totalBudget)
          ? "Monto total definido para el viaje"
          : "Cargando presupuesto del grupo",
    },
  ];

  return (
    <div className="flex flex-1 items-center justify-center bg-[#F4F9FA] px-6 py-8">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-[#CBDDE3] bg-white shadow-[0_24px_60px_rgba(7,59,82,0.14)]">
        <div className="relative h-48 overflow-hidden bg-[#073B52]">
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#0878CF] via-[#075B85] to-[#073B52]">
            <span className="font-heading text-6xl font-bold text-white/70">
              {title[0] ?? "V"}
            </span>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#073B52]/95 via-[#073B52]/45 to-transparent" />
          <div className="absolute bottom-5 left-6 right-6">
            <p className="font-body text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
              Cambiando de grupo
            </p>
            <h2 className="mt-1 truncate font-heading text-2xl font-bold text-white">
              {title}
            </h2>
            <p className="mt-1 line-clamp-2 font-body text-sm text-white/70">
              {destination}
            </p>
          </div>
        </div>

        <div className="px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0878CF]/10 text-[#075B85]">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
            </div>
            <div>
              <p className="font-heading text-base font-bold text-[#073B52]">
                Cargando información del viaje...
              </p>
              <p className="mt-1 font-body text-sm leading-relaxed text-[#526C79]">
                Estamos actualizando itinerario, participantes, presupuesto y
                chat del grupo seleccionado.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {loadingDetails.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-[#CBDDE3] bg-[#F4F9FA] px-4 py-3"
              >
                <p className="font-body text-[11px] font-semibold uppercase tracking-[0.14em] text-[#526C79]">
                  {item.label}
                </p>
                <p className="mt-1 font-heading text-base font-bold text-[#073B52]">
                  {item.value}
                </p>
                <p className="mt-1 font-body text-xs text-[#526C79]">
                  {item.hint}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd?: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl rounded-2xl border border-[#CBDDE3] bg-white px-6 py-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0878CF]/10">
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            className="text-[#075B85]"
            aria-hidden="true"
          >
            <rect
              x="3"
              y="4"
              width="18"
              height="18"
              rx="2"
              stroke="currentColor"
              strokeWidth="2"
            />
            <line
              x1="16"
              y1="2"
              x2="16"
              y2="6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line
              x1="8"
              y1="2"
              x2="8"
              y2="6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line
              x1="3"
              y1="10"
              x2="21"
              y2="10"
              stroke="currentColor"
              strokeWidth="2"
            />
            <line
              x1="8"
              y1="14"
              x2="16"
              y2="14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line
              x1="8"
              y1="18"
              x2="12"
              y2="18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h3 className="mb-2 font-heading text-xl font-bold text-[#073B52]">
          Aún no hay actividades en el itinerario.
        </h3>
        <p className="mx-auto mb-5 max-w-md font-body text-sm leading-relaxed text-[#526C79]">
          ¡Empieza añadiendo la primera!
        </p>
        {onAdd && (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0878CF] px-5 py-3 font-body text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <IconPlus size={14} />
            Agregar primera actividad
          </button>
        )}
      </div>
    </div>
  );
}

// Mismo orden que la lista del día (DayView): por hora de inicio y luego por título.
const sortByStartTime = (activities: DayActivity[]): DayActivity[] =>
  [...activities].sort((left, right) => {
    const l = left.startsAt ? Date.parse(left.startsAt) : Number.MAX_SAFE_INTEGER;
    const r = right.startsAt ? Date.parse(right.startsAt) : Number.MAX_SAFE_INTEGER;
    return l - r || left.title.localeCompare(right.title, "es");
  });

/** Pines del mapa: orden dentro del día seleccionado, o número de día en la vista general. */
const buildMapActivities = (
  activeDay: number | null,
  selectedDay: ItineraryDay | undefined,
  days: ItineraryDay[],
): TripMapActivity[] => {
  const toPin = (activity: DayActivity, glyph: string, dayNumber: number): TripMapActivity => ({
    id: activity.id,
    title: activity.title,
    glyph,
    caption: `Día ${dayNumber} · ${activity.time}`,
    location: activity.location ?? null,
    placeId: activity.placeId ?? null,
  });

  if (activeDay !== null) {
    return sortByStartTime(selectedDay?.activities ?? []).map((activity, index) =>
      toPin(activity, String(index + 1), activeDay),
    );
  }
  return days.flatMap((day) =>
    sortByStartTime(day.activities).map((activity) => toPin(activity, String(day.dayNumber), day.dayNumber)),
  );
};

function HeroCard({
  activeDay,
  totalDays,
  selectedDay,
  days,
  group,
  onAdd,
  onExportPdf,
}: {
  activeDay: number | null;
  totalDays: number;
  selectedDay?: ItineraryDay;
  days: ItineraryDay[];
  group: ReturnType<typeof getCurrentGroup> | null;
  onAdd?: () => void;
  onExportPdf: () => void;
}) {
  const mapsAvailable = useGoogleMapsAvailable();
  const [mapFailed, setMapFailed] = useState(false);
  const mapActivities = useMemo(
    () => buildMapActivities(activeDay, selectedDay, days),
    [activeDay, selectedDay, days],
  );
  const activities = mapActivities;
  const destination = group?.destino || "Destino pendiente";
  const heroTitle = group?.nombre || destination;
  const dateLabel = formatTripDateRange(group?.fecha_inicio, group?.fecha_fin);
  const heroImage =
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&h=400&fit=crop";

  const content = (
    <div className="relative flex min-h-[280px] flex-col justify-between gap-6 p-5">
      <div className="flex max-w-full flex-col items-start gap-2 sm:flex-row sm:flex-wrap">
        <span className="inline-flex max-w-full items-center gap-2 rounded-xl border border-[#91DEF0]/50 bg-[#0878CF]/45 px-3 py-2 font-body text-[13px] font-bold uppercase tracking-wide text-white shadow-sm backdrop-blur-md">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/20 text-[#E8F4FA]">
            <IconMapPinSmall />
          </span>
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">
            {activeDay !== null
              ? `DÍA ${activeDay} / ${totalDays}`
              : `${destination.toUpperCase()}`}
          </span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-xl border border-[#FFD166]/60 bg-[#765000]/80 px-3 py-2 font-body text-[13px] font-bold text-white shadow-md backdrop-blur-md">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/20 text-[#FFF4D6]">
            <IconCalendarSmall />
          </span>
          {dateLabel}
        </span>
      </div>
      <div>
        <h1
          className="mb-3 max-w-4xl break-words font-heading text-3xl font-bold leading-tight text-white [overflow-wrap:anywhere] md:text-[36px]"
          style={{
            textShadow:
              "0 2px 16px rgba(0,0,0,0.85), 0 1px 4px rgba(0,0,0,0.6)",
          }}
        >
          {heroTitle}
        </h1>
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/20 px-3 py-2 font-body text-sm font-bold text-white shadow-sm backdrop-blur-md">
            <span className="h-2.5 w-2.5 rounded-full bg-[#16B9D0]" />
            {activities.length} actividad{activities.length !== 1 ? "es" : ""}{" "}
            planeada
            {activities.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {onAdd && (
            <button
              onClick={onAdd}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0878CF] px-4 py-2.5 font-body text-base font-semibold text-white transition-opacity hover:opacity-90"
            >
              <IconPlus size={14} />
              Agregar actividad
            </button>
          )}
          <button
            onClick={onExportPdf}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/45 bg-black/10 px-4 py-2.5 font-body text-base font-semibold text-white transition-colors hover:bg-white/10"
          >
            <IconDownload size={13} />
            Exportar PDF
          </button>
        </div>
      </div>
    </div>
  );

  // Con Google Maps: el viaje a la izquierda y el mapa de sus actividades a la derecha.
  if (mapsAvailable && !mapFailed) {
    return (
      <div className="mb-4 grid shrink-0 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#073B52_0%,#075B85_60%,#0878CF_160%)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {content}
        <TripMap
          activities={mapActivities}
          destination={group?.destino}
          onUnavailable={() => setMapFailed(true)}
          className="min-h-[260px]"
        />
      </div>
    );
  }

  return (
    <div className="relative mb-4 min-h-[280px] shrink-0 overflow-hidden rounded-2xl">
      <img
        src={heroImage}
        alt={destination}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
      {content}
    </div>
  );
}

function TimelineStrip({
  activeDay,
  date,
  activities = [],
  onAdd,
}: {
  activeDay: number | null;
  date?: string;
  activities?: DayActivity[];
  onAdd?: () => void;
}) {
  if (activeDay === null) {
    return (
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-[#91DEF0] bg-[#E8F4FA] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0878CF]/10">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              className="text-[#075B85]"
              aria-hidden="true"
            >
              <rect
                x="3"
                y="4"
                width="18"
                height="18"
                rx="2"
                stroke="currentColor"
                strokeWidth="2"
              />
              <line
                x1="16"
                y1="2"
                x2="16"
                y2="6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="8"
                y1="2"
                x2="8"
                y2="6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="3"
                y1="10"
                x2="21"
                y2="10"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </div>
          <div>
            <p className="font-heading text-base font-bold text-[#073B52]">
              Selecciona un día para revisar el avance
            </p>
            <p className="font-body text-sm text-[#526C79]">
              O agrega directamente una actividad al itinerario.
            </p>
          </div>
        </div>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0878CF] px-4 py-2 font-body text-sm font-semibold text-white hover:bg-[#075EAA]"
          >
            <IconPlus size={13} />
            Agregar actividad
          </button>
        )}
      </div>
    );
  }

  const total = activities.length;
  const sortedActivities = [...activities].sort((left, right) => {
    const leftTime = left.startsAt
      ? new Date(left.startsAt).getTime()
      : Number.MAX_SAFE_INTEGER;
    const rightTime = right.startsAt
      ? new Date(right.startsAt).getTime()
      : Number.MAX_SAFE_INTEGER;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.title.localeCompare(right.title, "es");
  });
  const firstActivity = sortedActivities[0];
  const lastActivity = sortedActivities[sortedActivities.length - 1];

  return (
    <div className="mb-4 rounded-2xl border border-[#CBDDE3] bg-white px-5 py-4">
      <div className="flex items-start gap-5">
        <div className="shrink-0">
          <span className="inline-flex rounded-full bg-[#0878CF]/10 px-3 py-1 font-body text-[13px] font-bold leading-none text-[#075B85]">
            DÍA {activeDay}
            {date ? ` · ${date.toUpperCase()}` : ""}
          </span>
          <p className="mt-2 font-heading text-base font-bold leading-none text-[#073B52]">
            Resumen del día
          </p>
          <p className="mt-1 font-body text-sm leading-none text-[#526C79]">
            {total === 0
              ? "Sin actividades todavía"
              : `${total} actividad${total !== 1 ? "es" : ""} planeada${total !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {total > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {firstActivity && (
            <span className="rounded-full bg-[#E8F4FA] px-3 py-1 font-body text-[13px] leading-none text-[#075B85]">
              Primera: {firstActivity.time}
            </span>
          )}
          {lastActivity && lastActivity.id !== firstActivity?.id && (
            <span className="rounded-full bg-[#E8F4FA] px-3 py-1 font-body text-[13px] leading-none text-[#075B85]">
              Ultima: {lastActivity.time}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function toDateKey(value?: string | null): string | null {
  if (!value) return null;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 10);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);
  const byType = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function addDaysToDateKey(dateKey: string, daysToAdd: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}

function getTodayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isPastItineraryDay(
  tripStartDate: string | null | undefined,
  dayNumber: number,
): boolean {
  const startKey = toDateKey(tripStartDate);
  if (!startKey) return false;
  const dayKey = addDaysToDateKey(startKey, Math.max(0, dayNumber - 1));
  return dayKey < getTodayDateKey();
}

function formatTripDateRange(
  start?: string | null,
  end?: string | null,
): string {
  if (!start || !end) return "Fechas por definir";
  const startDate = new Date(`${toDateKey(start) ?? start}T00:00:00`);
  const endDate = new Date(`${toDateKey(end) ?? end}T00:00:00`);
  if (
    !Number.isFinite(startDate.getTime()) ||
    !Number.isFinite(endDate.getTime())
  ) {
    return `${start} - ${end}`;
  }
  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const sameMonth = sameYear && startDate.getMonth() === endDate.getMonth();
  const dayFormatter = new Intl.DateTimeFormat("es-MX", { day: "numeric" });
  const fullFormatter = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (sameMonth) {
    return `${dayFormatter.format(startDate)} al ${fullFormatter.format(endDate)}`;
  }
  return `${fullFormatter.format(startDate)} al ${fullFormatter.format(endDate)}`;
}

function BottomNavbar({
  activeTab,
  onTabChange,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  const tabs = [
    {
      id: "pagar",
      label: "Finanzas",
      color: "#0F766E",
      bg: "#E6FFFA",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <line
            x1="12"
            y1="1"
            x2="12"
            y2="23"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      id: "inicio",
      label: "Itinerario",
      color: "#1E6FD9",
      bg: "#EEF4FF",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points="9 22 9 12 15 12 15 22"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      id: "boveda",
      label: "Archivos",
      color: "#DB2777",
      bg: "#FCE7F3",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M21 8a2 2 0 00-2-2h-3l-2-2H10L8 6H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V8z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
  ];

  const visibleTabs = tabs;

  return (
    <div className="flex h-16 shrink-0 items-center justify-around border-t border-[#E2E8F0] bg-white px-4 shadow-[0_-10px_24px_rgba(15,23,42,0.04)]">
      {visibleTabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            aria-current={isActive ? "page" : undefined}
            className={[
              "rounded-xl px-3 py-1 font-body text-xs font-semibold transition-colors",
              isActive
                ? "text-[#1E0A4E]"
                : "text-gray500 hover:bg-white hover:text-gray700",
            ].join(" ")}
          >
            <span className="flex flex-col items-center gap-0.5">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-xl transition-transform duration-200"
                style={{
                  color: tab.color,
                  backgroundColor: isActive ? tab.bg : "transparent",
                }}
              >
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

const DASHBOARD_AUX_REQUEST_TIMEOUT_MS = 6500;
const DASHBOARD_MAIN_REQUEST_TIMEOUT_MS = 8500;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error("La peticion tardo demasiado en responder"));
    }, timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeoutId));
  });
}

interface DashboardUpdatedSocketPayload {
  grupoId?: number | string;
  groupId?: number | string;
  tipo?: string;
  entidadTipo?: string | null;
  entidadId?: number | string | null;
  actorUsuarioId?: number | string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

const isAccessDeniedError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const status = (error as { status?: number }).status;
  const message = error.message.toLowerCase();
  return (
    status === 403 ||
    message.includes("no perteneces") ||
    message.includes("acceso") ||
    message.includes("forbidden")
  );
};

const otherEntityForActivity = (
  link: ContextLink,
  activityId: string,
): ContextEntitySummary | null => {
  if (link.entityA.type === "activity" && link.entityA.id === activityId)
    return link.entityB;
  if (link.entityB.type === "activity" && link.entityB.id === activityId)
    return link.entityA;
  return null;
};

const isActivityContextType = (type: ContextEntityRef["type"]): boolean =>
  type === "expense" || type === "document";

type DashboardData = {
  group?: Group;
  members?: Parameters<typeof RightPanelDashboard>[0]["members"];
  days?: ItineraryDay[];
  budgetSummary?: BudgetSummary;
  contextLinks?: ContextLink[];
};

// Cada parte se pide por separado: si una falla (p. ej. el itinerario), lo demás
// del tablero (finanzas, integrantes, archivos) sigue funcionando.
async function fetchDashboardData(
  groupId: string,
  accessToken: string,
): Promise<DashboardData> {
  const [groupResult, membersResult, itineraryResult, budgetResult, contextResult] =
    await Promise.allSettled([
      withTimeout(
        groupsService.getGroupDetails(groupId, accessToken),
        DASHBOARD_AUX_REQUEST_TIMEOUT_MS,
      ),
      withTimeout(
        groupsService.getMembers(groupId, accessToken),
        DASHBOARD_AUX_REQUEST_TIMEOUT_MS,
      ),
      withTimeout(
        groupsService.getItinerary(groupId, accessToken),
        DASHBOARD_MAIN_REQUEST_TIMEOUT_MS,
      ),
      withTimeout(
        budgetService.getDashboard(groupId, accessToken),
        DASHBOARD_AUX_REQUEST_TIMEOUT_MS,
      ),
      withTimeout(
        contextLinksService.list(groupId, accessToken),
        DASHBOARD_AUX_REQUEST_TIMEOUT_MS,
      ),
    ]);

  if (itineraryResult.status === "rejected") {
    console.warn("No se pudo cargar el itinerario:", itineraryResult.reason);
  }

  return {
    group: groupResult.status === "fulfilled" ? groupResult.value.group : undefined,
    members:
      membersResult.status === "fulfilled"
        ? (membersResult.value.members ?? [])
        : undefined,
    days:
      itineraryResult.status === "fulfilled"
        ? (itineraryResult.value.days ?? [])
        : undefined,
    budgetSummary:
      budgetResult.status === "fulfilled" ? budgetResult.value.summary : undefined,
    contextLinks:
      contextResult.status === "fulfilled" ? contextResult.value.links : undefined,
  };
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { localUser, accessToken } = useAuth();
  const { socket, isConnected: isSocketConnected } = useSocket(accessToken);
  const isBrowserOnline = useNetworkMonitor();
  const areRealtimeActionsEnabled = isBrowserOnline && isSocketConnected;
  const offlineActionMessage =
    "Sin conexión. Reconecta para realizar esta acción.";

  const location = useLocation();
  const routeState = location.state as {
    groupId?: string | number;
    switchingGroup?: SwitchingGroupState;
    activeTab?: string;
  } | null;
  const groupIdFromState =
    routeState?.groupId !== undefined && routeState?.groupId !== null
      ? String(routeState.groupId)
      : null;
  const switchingGroupFromState = routeState?.switchingGroup;

  const groupId = searchParams.get("groupId");
  const currentGroup = getCurrentGroup();

  const userName = localUser?.nombre || localUser?.email || "Usuario";
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  // El tab inicial puede venir del state del router o de un query param `tab`
  // (usado por los enlaces de notificaciones para llevar al módulo relacionado).
  const tabFromQuery = searchParams.get("tab");
  const VALID_DASHBOARD_TABS = ["inicio", "pagar", "boveda"];
  const [activeTab, setActiveTab] = useState(
    routeState?.activeTab ??
      (tabFromQuery && VALID_DASHBOARD_TABS.includes(tabFromQuery)
        ? tabFromQuery
        : "pagar"),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [forcedNotice, setForcedNotice] = useState<{
    title: string;
    description: string;
  } | null>(null);
  const [activityPendingDelete, setActivityPendingDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(
    null,
  );
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [group, setGroup] = useState<typeof currentGroup>(currentGroup);
  const loadingGroupSnapshot = useMemo(() => {
    const current = currentGroup ?? null;
    const loaded = group ?? null;
    const switching = switchingGroupFromState ?? null;
    if (!current && !loaded && !switching) return null;
    return {
      ...(current ?? {}),
      ...(loaded ?? {}),
      ...(switching ?? {}),
    } as Group & SwitchingGroupState;
  }, [currentGroup, group, switchingGroupFromState]);
  const [members, setMembers] = useState<
    Parameters<typeof RightPanelDashboard>[0]["members"]
  >([]);
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(
    null,
  );
  const dayRefs = useRef<Record<number, DayViewHandle | null>>({});
  const collaborativeRefreshTimerRef = useRef<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [contextLinks, setContextLinks] = useState<ContextLink[]>([]);
  const chatOpenRef = useRef(chatOpen);

  // Keep ref in sync so the unread socket listener never captures stale chatOpen
  useEffect(() => {
    chatOpenRef.current = chatOpen;
  }, [chatOpen]);

  // Increment unread badge when a chat message arrives while the drawer is closed
  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = () => {
      if (!chatOpenRef.current) setChatUnread((c) => c + 1);
    };
    socket.on("chat_message", handleNewMessage);
    return () => {
      socket.off("chat_message", handleNewMessage);
    };
  }, [socket]);

  const handleDayChange = useCallback(
    (dayNumber: number) => {
      const next = activeDay === dayNumber ? null : dayNumber;
      setActiveDay(next);
      setExpandedDay(next);
    },
    [activeDay],
  );

  const isEmpty = days.length === 0;
  const resolvedGroupId =
    groupIdFromState ||
    groupId ||
    (currentGroup?.id ? String(currentGroup.id) : null);
  const safeMembers = useMemo(
    () =>
      (Array.isArray(members) ? members : []).filter(
        (member): member is NonNullable<NonNullable<typeof members>[number]> =>
          Boolean(member),
      ),
    [members],
  );
  const currentMember = safeMembers.find(
    (member) =>
      String(member.usuario_id ?? member.id) === String(localUser?.id_usuario),
  );
  const currentUserRole =
    currentMember?.rol ?? group?.myRole ?? currentGroup?.myRole ?? "viajero";
  const isCurrentUserAdmin =
    currentUserRole === "admin" || currentUserRole === "organizador";

  // Modo solo lectura: viaje cerrado, archivado o finalizado (CU-2.10 / CU-2.11)
  const isReadOnly = ["cerrado", "archivado", "finalizado"].includes(
    String(group?.estado ?? currentGroup?.estado ?? "").toLowerCase(),
  );
  const isItineraryLocked = Boolean(
    group?.modulo_itinerario_bloqueado ?? currentGroup?.modulo_itinerario_bloqueado,
  );
  const canEditItinerary = !isReadOnly && !isItineraryLocked;
  const tripStartKey = toDateKey(group?.fecha_inicio ?? currentGroup?.fecha_inicio ?? null);
  const tripEndKey = toDateKey(group?.fecha_fin ?? currentGroup?.fecha_fin ?? null);
  const todayKey = getTodayDateKey();
  const activityMinDate =
    tripStartKey && tripStartKey > todayKey ? tripStartKey : todayKey;
  // Formulario de actividad: sin `activity` crea una nueva en `date`.
  const [activityForm, setActivityForm] = useState<{
    activity: DayActivity | null;
    date: string | null;
  } | null>(null);

  const chatParticipants = useMemo(() => {
    const colors = ["#1E6FD9", "#35C56A", "#7A4FD6", "#F59E0B"];
    const seen = new Set<string>();
    return safeMembers
      .filter((m) => {
        const key = String(m.usuario_id ?? m.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((m, i) => ({
        id: String(m.usuario_id ?? m.id),
        name: m.nombre || m.email || "Usuario",
        color: colors[i % colors.length],
        avatarUrl: m.avatar_url ?? null,
      }));
  }, [safeMembers]);

  const getLinksForActivity = useCallback(
    (activityId: string) => {
      return contextLinks
        .map((link) => otherEntityForActivity(link, activityId))
        .filter(
          (entity): entity is ContextEntitySummary =>
            entity !== null && isActivityContextType(entity.type),
        );
    },
    [contextLinks],
  );

  const daysWithContext = useMemo(
    () =>
      days.map((day) => ({
        ...day,
        activities: day.activities.map((activity) => ({
          ...activity,
          linkedContext: getLinksForActivity(activity.id),
        })),
      })),
    [days, getLinksForActivity],
  );

  const selectedDayWithContext =
    activeDay !== null
      ? daysWithContext.find((day) => day.dayNumber === activeDay)
      : undefined;

  const applyDashboardData = useCallback((data: DashboardData) => {
    if (data.group) {
      setGroup(data.group);
      saveCurrentGroup(data.group);
    }
    if (data.members) setMembers(data.members);
    if (data.days) setDays(data.days);
    if (data.budgetSummary) setBudgetSummary(data.budgetSummary);
    if (data.contextLinks) setContextLinks(data.contextLinks);
  }, []);

  useEffect(() => {
    const resolvedGroupId =
      groupIdFromState ||
      groupId ||
      (currentGroup?.id ? String(currentGroup.id) : null);

    if (!resolvedGroupId) {
      navigate("/my-trips");
      return;
    }

    if (!accessToken) return;

    let isMounted = true;

    const loadDashboard = async () => {
      try {
        setIsLoading(true);

        // Valida el acceso al viaje antes de pedir lo demás (403 → aviso de acceso revocado).
        await withTimeout(
          groupsService.getGroupDetails(resolvedGroupId, accessToken),
          DASHBOARD_AUX_REQUEST_TIMEOUT_MS,
        );

        const data = await fetchDashboardData(resolvedGroupId, accessToken);
        if (isMounted) applyDashboardData(data);
      } catch (error) {
        console.error("Error cargando dashboard:", error);
        if (isAccessDeniedError(error)) {
          clearCurrentGroup();
          setForcedNotice({
            title: "Acceso revocado",
            description:
              "Ya no tienes acceso a este viaje. Te regresaremos a Mis viajes.",
          });
          return;
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [
    groupIdFromState,
    groupId,
    currentGroup?.id,
    accessToken,
    navigate,
    applyDashboardData,
  ]);

  const reloadDashboard = useCallback(async () => {
    const resolvedGroupId =
      groupIdFromState ||
      groupId ||
      (currentGroup?.id ? String(currentGroup.id) : null);

    if (!resolvedGroupId || !accessToken) return;

    applyDashboardData(await fetchDashboardData(resolvedGroupId, accessToken));
  }, [groupIdFromState, groupId, currentGroup?.id, accessToken, applyDashboardData]);

  useEffect(() => {
    if (!socket || !resolvedGroupId || !accessToken) return;

    const scheduleCollaborativeRefresh = (
      payload?: DashboardUpdatedSocketPayload,
    ) => {
      const payloadGroupId = payload?.grupoId ?? payload?.groupId;
      if (
        payloadGroupId !== undefined &&
        String(payloadGroupId) !== String(resolvedGroupId)
      )
        return;

      if (collaborativeRefreshTimerRef.current !== null) {
        window.clearTimeout(collaborativeRefreshTimerRef.current);
      }

      collaborativeRefreshTimerRef.current = window.setTimeout(() => {
        void (async () => {
          try {
            await reloadDashboard();
          } catch (error) {
            console.error("Error actualizando dashboard colaborativo:", error);
          }
        })();
      }, 250);
    };

    const handleDashboardUpdated = (payload: DashboardUpdatedSocketPayload) => {
      const tipo = String(payload?.tipo ?? "");
      if (tipo === "grupo_eliminado") {
        clearCurrentGroup();
        setForcedNotice({
          title: "Grupo eliminado",
          description:
            "Este grupo fue eliminado por el administrador. Te regresaremos a Mis viajes.",
        });
        return;
      }

      const targetUsuarioId = payload?.metadata?.targetUsuarioId;
      if (
        tipo === "miembro_eliminado" &&
        targetUsuarioId !== undefined &&
        String(targetUsuarioId) === String(localUser?.id_usuario)
      ) {
        clearCurrentGroup();
        setForcedNotice({
          title: "Fuiste removido del viaje",
          description:
            "Tu acceso a este viaje fue revocado. Te regresaremos a Mis viajes.",
        });
        return;
      }

      scheduleCollaborativeRefresh(payload);
    };

    socket.on("dashboard_updated", handleDashboardUpdated);
    socket.on("group_deleted", handleDashboardUpdated);

    return () => {
      if (collaborativeRefreshTimerRef.current !== null) {
        window.clearTimeout(collaborativeRefreshTimerRef.current);
        collaborativeRefreshTimerRef.current = null;
      }
      socket.off("dashboard_updated", handleDashboardUpdated);
      socket.off("group_deleted", handleDashboardUpdated);
    };
  }, [
    socket,
    resolvedGroupId,
    accessToken,
    reloadDashboard,
    navigate,
    localUser?.id_usuario,
  ]);

  const openActivityModalForDay = useCallback(
    (dayNumber: number) => {
      if (!canEditItinerary) return;
      setActiveDay(dayNumber);
      setExpandedDay(dayNumber);
      setActivityForm({
        activity: null,
        date: tripStartKey ? addDaysToDateKey(tripStartKey, dayNumber - 1) : null,
      });
    },
    [canEditItinerary, tripStartKey],
  );

  const openActivityEditor = useCallback((activity: DayActivity) => {
    setActivityForm({ activity, date: null });
  }, []);

  const handleSubmitActivity = useCallback(
    async (values: ActivityFormValues) => {
      if (!resolvedGroupId || !accessToken) {
        throw new Error("Tu sesión no está disponible. Vuelve a iniciar sesión.");
      }
      if (activityForm?.activity) {
        await groupsService.updateActivity(
          resolvedGroupId,
          activityForm.activity.id,
          values,
          accessToken,
        );
      } else {
        await groupsService.createActivity(resolvedGroupId, values, accessToken);
      }
      setActivityForm(null);
      await reloadDashboard();
    },
    [accessToken, activityForm, reloadDashboard, resolvedGroupId],
  );

  const handleDeleteActivity = useCallback(
    (activityId: string) => {
      const activityName =
        selectedDayWithContext?.activities.find(
          (activity) => String(activity.id) === String(activityId),
        )?.title ?? "esta actividad";

      setActivityPendingDelete({ id: activityId, title: activityName });
    },
    [selectedDayWithContext?.activities],
  );

  const confirmDeleteActivity = useCallback(async () => {
    const resolvedGroupId =
      groupIdFromState ||
      groupId ||
      (currentGroup?.id ? String(currentGroup.id) : null);

    if (!activityPendingDelete || !resolvedGroupId || !accessToken) return;

    try {
      setDeletingActivityId(activityPendingDelete.id);
      await groupsService.deleteActivity(
        String(resolvedGroupId),
        activityPendingDelete.id,
        accessToken,
      );
      setActivityPendingDelete(null);
      await reloadDashboard();
    } finally {
      setDeletingActivityId(null);
    }
  }, [
    accessToken,
    activityPendingDelete,
    currentGroup?.id,
    groupId,
    groupIdFromState,
    reloadDashboard,
  ]);

  const handleExportConfirmedItineraryPdf = useCallback(() => {
    const escapeHtml = (value: string) =>
      value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

    const confirmedByDay = days
      .map((day) => ({
        dayNumber: day.dayNumber,
        date: day.date,
        activities: day.activities,
      }))
      .filter((day) => day.activities.length > 0);

    if (confirmedByDay.length === 0) {
      window.alert(
        "El itinerario todavía no tiene actividades para exportar.",
      );
      return;
    }

    const generatedAt = new Date().toLocaleString("es-MX", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const sectionsHtml = confirmedByDay
      .map((day) => {
        const items = day.activities
          .map((activity, index) => {
            return `
              <article class="activity-card">
                <div class="activity-index">${index + 1}</div>
                <div class="activity-content">
                  <h4>${escapeHtml(activity.title)}</h4>
                  <p class="desc">${escapeHtml(activity.description || "Sin descripción")}</p>
                  <div class="chips">
                    <span>Hora: ${escapeHtml(activity.time || "Hora pendiente")}</span>
                    <span>${escapeHtml(activity.location || "Ubicación no disponible")}</span>
                  </div>
                </div>
              </article>
            `;
          })
          .join("");

        return `
          <section class="day-section">
            <div class="day-header">
              <h3>Día ${day.dayNumber}</h3>
              <span>${escapeHtml(day.date)}</span>
            </div>
            ${items}
          </section>
        `;
      })
      .join("");

    const tripName = escapeHtml(group?.nombre || "Itinerario");
    const tripDestination = escapeHtml(
      group?.destino || "Destino pendiente",
    );
    const html = `
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>Itinerario - ${tripName}</title>
          <style>
            :root {
              --ink:#1E0A4E;
              --ink-soft:#2E1767;
              --blue:#1E6FD9;
              --blue-soft:#EEF4FF;
              --purple:#7A4FD6;
              --purple-soft:#F3EEFF;
              --green:#35C56A;
              --paper:#FFFFFF;
              --text:#243247;
              --muted:#64748B;
            }
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body {
              margin:0;
              font-family:"Segoe UI",Tahoma,Geneva,Verdana,sans-serif;
              color:var(--text);
              background:linear-gradient(145deg,#EBE6FA 0%,#EAF2FF 100%);
              padding:24px;
            }
            .sheet {
              max-width:900px;
              margin:0 auto;
              background:var(--paper);
              border:1px solid #D9E4F7;
              border-radius:20px;
              overflow:hidden;
              box-shadow:0 24px 56px rgba(30,10,78,0.18);
            }
            .hero {
              background:
                radial-gradient(circle at top right, rgba(122,79,214,.24), transparent 44%),
                radial-gradient(circle at top left, rgba(30,111,217,.22), transparent 38%),
                linear-gradient(120deg,var(--ink),var(--ink-soft));
              color:#fff;
              padding:28px 30px;
            }
            .hero h1 { margin:0; font-size:30px; line-height:1.05; letter-spacing:0; }
            .hero p { margin:9px 0 0; font-size:14px; color:rgba(255,255,255,.9); }
            .meta { display:flex; gap:8px; flex-wrap:wrap; margin-top:14px; }
            .meta span {
              background:rgba(255,255,255,.14);
              border:1px solid rgba(255,255,255,.28);
              padding:6px 10px;
              border-radius:999px;
              font-size:11px;
              font-weight:600;
            }
            .content { padding:18px 20px 26px; background:linear-gradient(180deg,#FAFCFF 0%,#FFFFFF 18%); }
            .day-section + .day-section { margin-top:14px; }
            .day-section {
              border:1px solid #DEE7FB;
              border-radius:16px;
              background:#fff;
              overflow:hidden;
            }
            .day-header {
              display:flex;
              align-items:center;
              justify-content:space-between;
              gap:10px;
              padding:12px 14px;
              background:linear-gradient(90deg,var(--purple-soft),#F8FAFF);
              border-bottom:1px solid #E5ECFA;
            }
            .day-header h3 { margin:0; color:var(--ink); font-size:16px; }
            .day-header span { color:#4B5F86; font-size:12px; font-weight:700; }
            .activity-card {
              display:flex;
              gap:12px;
              background:#fff;
              border-left:4px solid var(--blue);
              border-bottom:1px solid #EEF2FB;
              padding:12px 14px;
              margin:0;
            }
            .day-section .activity-card:last-child { border-bottom:0; }
            .activity-index {
              width:28px;
              height:28px;
              border-radius:999px;
              background:linear-gradient(140deg,var(--blue),#4A8DF0);
              color:#fff;
              display:grid;
              place-items:center;
              font-size:12px;
              font-weight:800;
              flex-shrink:0;
              box-shadow:0 6px 14px rgba(30,111,217,.26);
            }
            .activity-content h4 { margin:0; color:var(--ink); font-size:15px; }
            .activity-content .desc { margin:4px 0 0; color:#4A5C77; font-size:12px; line-height:1.45; }
            .chips { display:flex; gap:6px; flex-wrap:wrap; margin-top:9px; }
            .chips span {
              background:var(--purple-soft);
              border:1px solid #DCCEFF;
              color:#452A84;
              font-size:10.5px;
              padding:4px 8px;
              border-radius:999px;
              font-weight:600;
            }
            .footer {
              border-top:1px solid #E5ECFA;
              background:#FAFCFF;
              padding:12px 20px;
              color:var(--muted);
              font-size:11px;
              display:flex;
              justify-content:space-between;
              align-items:center;
            }
            .dot { width:8px; height:8px; border-radius:999px; background:var(--green); display:inline-block; margin-right:6px; }
            @media print {
              body { background:#EEE8FB; padding:0; }
              .sheet { border:0; border-radius:0; box-shadow:none; max-width:100%; }
              @page { size:A4; margin:10mm; }
            }
          </style>
        </head>
        <body>
          <main class="sheet">
            <header class="hero">
              <h1>Itinerario del viaje</h1>
              <p>${tripName} · ${tripDestination}</p>
              <div class="meta">
                <span>${confirmedByDay.length} día(s) con actividades</span>
                <span>${confirmedByDay.reduce((acc, day) => acc + day.activities.length, 0)} actividad(es)</span>
              </div>
            </header>
            <section class="content">${sectionsHtml}</section>
            <footer class="footer">
              <span><i class="dot"></i>Generado por Traveling</span>
              <span>${escapeHtml(generatedAt)}</span>
            </footer>
          </main>
        </body>
      </html>
    `;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, "_blank");

    if (!win) {
      URL.revokeObjectURL(blobUrl);
      window.alert(
        "No se pudo abrir la ventana de exportación. Revisa el bloqueador de ventanas.",
      );
      return;
    }

    const cleanup = () => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {
        // noop
      }
    };

    const onLoad = () => {
      try {
        win.focus();
        win.print();
      } finally {
        cleanup();
      }
    };

    try {
      win.addEventListener("load", onLoad, { once: true });
    } catch {
      window.setTimeout(() => {
        try {
          win.focus();
          win.print();
        } finally {
          cleanup();
        }
      }, 700);
    }
  }, [days, group]);

  return (
    <AppLayout
      trip={{
        name: group?.nombre || "Itinerario",
        subtitle: group?.destino || "Destino pendiente",
        dates: formatTripDateRange(group?.fecha_inicio, group?.fecha_fin),
        people: group?.maximo_miembros
          ? `${group.maximo_miembros} personas máx.`
          : "Miembros por definir",
      }}
      user={{
        name: userName,
        role: isCurrentUserAdmin ? "Organizador" : "Viajero",
        initials,
        color: "#1E6FD9",
      }}
      isOnline={isBrowserOnline && isSocketConnected}
      onOpenChat={() => {
        setChatOpen(true);
        setChatUnread(0);
      }}
      chatUnreadCount={chatUnread}
      sidebarContent={
        <SidebarDashboard
          activeDay={activeDay}
          days={days}
          group={group}
          onDayChange={handleDayChange}
          onOpenGroupPanel={() =>
            navigate(
              `/grouppanel?groupId=${encodeURIComponent(groupId || currentGroup?.id || "")}`,
            )
          }
          onOpenGroupSettings={() =>
            navigate(
              `/group-settings?groupId=${encodeURIComponent(groupId || currentGroup?.id || "")}`,
            )
          }
        />
      }
      rightPanel={
        <RightPanelDashboard
          members={members}
          group={group}
          isLoading={isLoading}
          socket={socket}
          onOpenChat={() => {
            setChatOpen(true);
            setChatUnread(0);
          }}
          chatUnreadCount={chatUnread}
          onOpenBudget={() => setActiveTab("pagar")}
          onOpenGroupPanel={() =>
            navigate(
              `/grouppanel?groupId=${encodeURIComponent(groupId || currentGroup?.id || "")}`,
            )
          }
          totalBudget={budgetSummary?.totalBudget ?? undefined}
          committedBudget={budgetSummary?.committed}
        />
      }
    >
      {isLoading ? (
        <DashboardSwitchLoading group={loadingGroupSnapshot} />
      ) : activeTab === "pagar" ? (
        <div className="flex-1 overflow-y-auto bg-surface px-6 py-6">
          {isReadOnly && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] px-4 py-3">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                className="mt-0.5 shrink-0 text-[#64748B]"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <line
                  x1="12"
                  y1="8"
                  x2="12"
                  y2="12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="16" r="1" fill="currentColor" />
              </svg>
              <p className="font-body text-[12px] text-[#64748B] leading-relaxed">
                Presupuesto en modo lectura. Puedes consultar balances y deudas,
                pero no registrar nuevos gastos.
              </p>
            </div>
          )}
          <BudgetDashboard
            groupId={resolvedGroupId ?? null}
            onSummaryChange={setBudgetSummary}
            onOpenVault={() => setActiveTab("boveda")}
            onOpenItinerary={() => setActiveTab("inicio")}
            isReadOnly={isReadOnly}
          />
        </div>
      ) : activeTab === "boveda" ? (
        <DocumentVaultPanel
          groupId={resolvedGroupId ?? null}
          members={members}
          currentUser={localUser ?? null}
          onOpenBudget={() => setActiveTab("pagar")}
          onOpenItinerary={() => setActiveTab("inicio")}
          isReadOnly={isReadOnly}
        />
      ) : isEmpty ? (
        <EmptyState
          onAdd={canEditItinerary ? () => openActivityModalForDay(1) : undefined}
        />
      ) : (
        <div className="flex-1 overflow-y-auto bg-surface px-6 py-6">
          <HeroCard
            activeDay={activeDay}
            totalDays={daysWithContext.length}
            selectedDay={selectedDayWithContext}
            days={daysWithContext}
            group={group}
            onAdd={
              canEditItinerary && areRealtimeActionsEnabled
                ? () =>
                    openActivityModalForDay(
                      activeDay ?? daysWithContext[0]?.dayNumber ?? 1,
                    )
                : undefined
            }
            onExportPdf={handleExportConfirmedItineraryPdf}
          />
          {/* ── Banner modo solo lectura (ERR-211-002 / CU-2.10) ── */}
          {isReadOnly && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] px-4 py-3">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                className="mt-0.5 shrink-0 text-[#64748B]"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <line
                  x1="12"
                  y1="8"
                  x2="12"
                  y2="12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="16" r="1" fill="currentColor" />
              </svg>
              <p className="font-body text-[12px] text-[#64748B] leading-relaxed">
                Este viaje ya finalizó. Puedes consultar el itinerario y el
                resumen financiero en modo lectura.
              </p>
            </div>
          )}
          {/* ── Day tabs + single active day ── */}
          {daysWithContext.length > 0 &&
            (() => {
              const activeDayNumber = expandedDay;
              const activeDayData =
                activeDayNumber !== null
                  ? (daysWithContext.find(
                      (d) => d.dayNumber === activeDayNumber,
                    ) ?? null)
                  : null;
              const isPastActiveDay = isPastItineraryDay(
                group?.fecha_inicio ?? currentGroup?.fecha_inicio ?? null,
                activeDayData?.dayNumber ?? 1,
              );

              return (
                <div className="space-y-3">
                  {/* Tab strip */}
                  <div className="overflow-x-auto rounded-2xl bg-[linear-gradient(135deg,#073B52_0%,#073B52_52%,#075B85_100%)] px-4 py-3 shadow-[0_8px_28px_rgba(7,59,82,0.22)]">
                    <div className="flex gap-2">
                      {daysWithContext.map((day) => {
                        const isActive = day.dayNumber === activeDayNumber;
                        const count = day.activities.length;
                        const isEmpty = day.activities.length === 0;
                        return (
                          <button
                            key={day.dayNumber}
                            type="button"
                            onClick={() => {
                              const next =
                                day.dayNumber === activeDayNumber
                                  ? null
                                  : day.dayNumber;
                              setActiveDay(next);
                              setExpandedDay(next);
                            }}
                            className={[
                              "flex shrink-0 flex-col items-center gap-1.5 rounded-2xl px-5 py-3 transition-all duration-200 min-w-[110px]",
                              isActive
                                ? "bg-white shadow-[0_10px_28px_rgba(0,0,0,0.22)]"
                                : "border border-white/10 bg-white/[0.07] hover:bg-white/[0.14]",
                            ].join(" ")}
                          >
                            {/* Day number pill */}
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-body text-[11px] font-bold uppercase tracking-wider ${
                                isActive
                                  ? "bg-[#0878CF]/12 text-[#075EAA]"
                                  : "bg-white/10 text-white/55"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-[#0878CF]" : "bg-white/30"}`}
                              />
                              Día {day.dayNumber}
                            </span>
                            {/* Date */}
                            <span
                              className={`font-body text-sm font-semibold leading-tight text-center ${isActive ? "text-[#073B52]" : "text-white/80"}`}
                            >
                              {day.date}
                            </span>
                            {/* Activity badges */}
                            <div className="flex items-center gap-1">
                              {isEmpty ? (
                                <span
                                  className={`rounded-full px-2 py-0.5 font-body text-xs font-medium ${isActive ? "bg-[#F1F5F9] text-[#94A3B8]" : "bg-white/10 text-white/35"}`}
                                >
                                  Sin actividades
                                </span>
                              ) : (
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 font-body text-xs font-semibold ${isActive ? "bg-[#E8F4FA] text-[#075B85]" : "bg-[#16B9D0]/20 text-[#91DEF0]"}`}
                                >
                                  {count} actividad{count !== 1 ? "es" : ""}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Progress of selected day */}
                  <TimelineStrip
                    activeDay={activeDay}
                    date={selectedDayWithContext?.date}
                    activities={selectedDayWithContext?.activities}
                    onAdd={
                      canEditItinerary && areRealtimeActionsEnabled
                        ? () =>
                            openActivityModalForDay(
                              activeDay ?? daysWithContext[0]?.dayNumber ?? 1,
                            )
                        : undefined
                    }
                  />

                  {/* Active day view */}
                  {activeDayData && (
                    <DayView
                      key={activeDayData.dayNumber}
                      ref={(handle) => {
                        dayRefs.current[activeDayData.dayNumber] = handle;
                      }}
                      dayNumber={activeDayData.dayNumber}
                      date={activeDayData.date}
                      activities={activeDayData.activities}
                      currentUserId={localUser?.id_usuario}
                      currentUserRole={currentUserRole}
                      isActive={true}
                      isExpanded={true}
                      onSelect={(dn) => {
                        setActiveDay(dn);
                        setExpandedDay(dn);
                      }}
                      onOpenBudget={() => setActiveTab("pagar")}
                      onOpenVault={() => setActiveTab("boveda")}
                      onAddActivity={
                        canEditItinerary && !isPastActiveDay
                          ? openActivityModalForDay
                          : undefined
                      }
                      onEdit={
                        canEditItinerary && !isPastActiveDay
                          ? openActivityEditor
                          : undefined
                      }
                      onDelete={
                        canEditItinerary && !isPastActiveDay
                          ? handleDeleteActivity
                          : undefined
                      }
                      isPastDay={isPastActiveDay}
                      actionsDisabled={!areRealtimeActionsEnabled}
                      actionsDisabledReason={offlineActionMessage}
                    />
                  )}
                </div>
              );
            })()}
        </div>
      )}

      <BottomNavbar activeTab={activeTab} onTabChange={setActiveTab} />
      <ActivityFormModal
        open={activityForm !== null}
        activity={activityForm?.activity ?? null}
        defaultDate={activityForm?.date ?? null}
        minDate={activityMinDate}
        maxDate={tripEndKey}
        destination={group?.destino ?? null}
        onClose={() => setActivityForm(null)}
        onSubmit={handleSubmitActivity}
      />
      <ConfirmDialog
        open={activityPendingDelete !== null}
        title="Eliminar actividad"
        description="Esta acción no se puede deshacer. También se quitan sus enlaces con gastos y documentos."
        details={activityPendingDelete?.title}
        confirmLabel="Eliminar actividad"
        cancelLabel="Conservar"
        variant="danger"
        loading={
          activityPendingDelete
            ? deletingActivityId === activityPendingDelete.id
            : false
        }
        onCancel={() => {
          if (deletingActivityId === null) setActivityPendingDelete(null);
        }}
        onConfirm={() => {
          void confirmDeleteActivity();
        }}
      />

      <ConfirmDialog
        open={forcedNotice !== null}
        title={forcedNotice?.title ?? "Aviso del viaje"}
        description={
          forcedNotice?.description ?? "Te regresaremos a Mis viajes."
        }
        confirmLabel="Ir a Mis viajes"
        cancelLabel="Cerrar"
        variant="warning"
        onCancel={() => navigate("/my-trips")}
        onConfirm={() => navigate("/my-trips")}
      />

      <ChatDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        groupId={resolvedGroupId}
        groupName={group?.nombre || "Grupo"}
        socket={socket}
        isSocketConnected={isSocketConnected}
        accessToken={accessToken}
        currentUserId={
          localUser?.id_usuario != null ? String(localUser.id_usuario) : null
        }
        currentUserName={userName}
        participants={chatParticipants}
        isReadOnly={isReadOnly}
      />
    </AppLayout>
  );
}
