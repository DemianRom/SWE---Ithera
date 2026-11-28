import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { ContextEntitySummary } from "../../../services/context-links";
import { googleMapsPlaceUrl } from "../../../lib/googleMaps";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface Activity {
  id: string;
  title: string;
  description: string;
  location?: string;
  /** Place ID de Google Places (lugar elegido de las sugerencias). */
  placeId?: string | null;
  /** Hora de inicio (HH:mm, Ciudad de México). */
  time: string;
  startsAt?: string | null;
  endsAt?: string | null;
  status: "confirmada";
  createdBy?: string | null;
  createdByName?: string | null;
  category: "actividad";
  price: number;
  currency: string;
  image: string;
  /** Gastos y documentos ligados (trip_context_links). */
  linkedContext?: ContextEntitySummary[];
}

export interface DayViewProps {
  dayNumber: number;
  date: string;
  activities: Activity[];
  isActive?: boolean;
  defaultExpanded?: boolean;
  isExpanded?: boolean;
  onSelect?: (dayNumber: number) => void;
  onAddActivity?: (dayNumber: number) => void;
  onEdit?: (activity: Activity) => void;
  onDelete?: (activityId: string) => void | Promise<void>;
  onOpenBudget?: () => void;
  onOpenVault?: () => void;
  currentUserId?: string | number | null;
  currentUserRole?: "admin" | "viajero" | string | null;
  isPastDay?: boolean;
  actionsDisabled?: boolean;
  actionsDisabledReason?: string;
}

export interface DayViewHandle {
  scrollIntoView: () => void;
}

// ── Utilidades ────────────────────────────────────────────────────────────────

const TIME_ZONE = "America/Mexico_City";

function formatTime(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

function formatTimeRange(activity: Activity): string {
  const start = formatTime(activity.startsAt) ?? activity.time;
  const end = formatTime(activity.endsAt);
  return end ? `${start} – ${end}` : start;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value);
}

function sortByStart(activities: Activity[]): Activity[] {
  return [...activities].sort((left, right) => {
    const l = left.startsAt ? new Date(left.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
    const r = right.startsAt ? new Date(right.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
    return l - r || left.title.localeCompare(right.title, "es");
  });
}

// ── Íconos ────────────────────────────────────────────────────────────────────

function IconChevron({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconMapPin({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 22s7-5.2 7-12a7 7 0 10-14 0c0 6.8 7 12 7 12z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconEdit({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrash({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPlus({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ── Tarjeta de actividad ──────────────────────────────────────────────────────

function LinkedContext({
  activity,
  onOpenBudget,
  onOpenVault,
}: {
  activity: Activity;
  onOpenBudget?: () => void;
  onOpenVault?: () => void;
}) {
  const linked = activity.linkedContext ?? [];
  const expenses = linked.filter((entity) => entity.type === "expense");
  const documents = linked.filter((entity) => entity.type === "document");
  if (linked.length === 0) return null;

  const spent = expenses.reduce((sum, entity) => {
    const amount = Number(entity.metadata?.amount ?? 0);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);

  return (
    <div className="mt-3 rounded-xl border border-[#CBDDE3] bg-[#F4F9FA] px-3 py-2.5">
      {expenses.length > 0 && (
        <p className="mb-2 font-body text-sm font-semibold text-[#073B52]">
          Gastado aquí: <span className="text-[#0878CF]">{formatMoney(spent)}</span>
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {expenses.map((entity) => (
          <button
            key={`${entity.type}:${entity.id}`}
            type="button"
            onClick={onOpenBudget}
            className="max-w-full truncate rounded-full border border-[#CBDDE3] bg-[#E8F4FA] px-2.5 py-1 font-body text-[13px] font-semibold text-[#0878CF] hover:bg-[#D5F0F5]"
            title={entity.subtitle ?? entity.label}
          >
            Gasto: <span className="font-medium">{entity.label}</span>
          </button>
        ))}
        {documents.map((entity) => (
          <button
            key={`${entity.type}:${entity.id}`}
            type="button"
            onClick={onOpenVault}
            className="max-w-full truncate rounded-full border border-[#CBDDE3] bg-[#E8F4FA] px-2.5 py-1 font-body text-[13px] font-semibold text-[#075B85] hover:bg-[#D5F0F5]"
            title={entity.label}
          >
            Documento: <span className="font-medium">{entity.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ActivityCard({
  activity,
  canManage,
  onEdit,
  onDelete,
  onOpenBudget,
  onOpenVault,
  actionsDisabled,
  actionsDisabledReason,
}: {
  activity: Activity;
  canManage: boolean;
  onEdit?: (activity: Activity) => void;
  onDelete?: (activityId: string) => void | Promise<void>;
  onOpenBudget?: () => void;
  onOpenVault?: () => void;
  actionsDisabled: boolean;
  actionsDisabledReason?: string;
}) {
  const showEdit = canManage && Boolean(onEdit);
  const showDelete = canManage && Boolean(onDelete);

  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
      <div className="flex justify-end pt-1">
        <span className="inline-flex h-7 min-w-[60px] items-center justify-center rounded-full border border-[#CBDDE3] bg-white px-2.5 font-body text-[13px] font-bold text-[#075B85]">
          {formatTime(activity.startsAt) ?? activity.time}
        </span>
      </div>

      <article className="rounded-2xl border border-[#CBDDE3] bg-white px-5 py-4 shadow-[0_6px_18px_rgba(7,59,82,0.05)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-heading text-base font-bold leading-snug text-[#073B52]">
              {activity.title}
            </h3>
            <p className="mt-0.5 font-body text-sm text-[#526C79]">
              {formatTimeRange(activity)}
              {activity.createdByName ? ` · Agregada por ${activity.createdByName}` : ""}
            </p>
          </div>

          {(showEdit || showDelete) && (
            <div className="flex shrink-0 gap-2">
              {showEdit && (
                <button
                  type="button"
                  onClick={() => !actionsDisabled && onEdit?.(activity)}
                  disabled={actionsDisabled}
                  title={actionsDisabled ? actionsDisabledReason : "Editar actividad"}
                  aria-label="Editar actividad"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#CBDDE3] bg-white text-[#075B85] transition-colors hover:border-[#0878CF]/30 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <IconEdit />
                </button>
              )}
              {showDelete && (
                <button
                  type="button"
                  onClick={() => !actionsDisabled && void onDelete?.(activity.id)}
                  disabled={actionsDisabled}
                  title={actionsDisabled ? actionsDisabledReason : "Eliminar actividad"}
                  aria-label="Eliminar actividad"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#CBDDE3] bg-white text-[#526C79] transition-colors hover:border-red-200 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <IconTrash />
                </button>
              )}
            </div>
          )}
        </div>

        {activity.description && (
          <p className="mt-2 whitespace-pre-line font-body text-sm leading-relaxed text-[#183F51]">
            {activity.description}
          </p>
        )}

        {activity.location && (
          <a
            href={googleMapsPlaceUrl(activity.location, activity.placeId)}
            target="_blank"
            rel="noreferrer"
            title="Abrir en Google Maps"
            className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#F4F9FA] px-3 py-1 font-body text-sm text-[#183F51] transition-colors hover:bg-[#D5F0F5]"
          >
            <span className="text-[#075B85]">
              <IconMapPin />
            </span>
            <span className="truncate">{activity.location}</span>
          </a>
        )}

        <LinkedContext activity={activity} onOpenBudget={onOpenBudget} onOpenVault={onOpenVault} />
      </article>
    </div>
  );
}

// ── Día ───────────────────────────────────────────────────────────────────────

export const DayView = forwardRef<DayViewHandle, DayViewProps>(function DayView(
  {
    dayNumber,
    date,
    activities,
    defaultExpanded = false,
    isExpanded: controlledExpanded,
    onSelect,
    onAddActivity,
    onEdit,
    onDelete,
    onOpenBudget,
    onOpenVault,
    currentUserId,
    currentUserRole,
    isPastDay = false,
    actionsDisabled = false,
    actionsDisabledReason,
  },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isControlled = controlledExpanded !== undefined;
  const expanded = isControlled ? controlledExpanded : internalExpanded;

  useImperativeHandle(ref, () => ({
    scrollIntoView() {
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
  }));

  const sorted = sortByStart(activities);
  const isAdmin = currentUserRole === "admin" || currentUserRole === "organizador";
  const canAdd = Boolean(onAddActivity) && !isPastDay;

  return (
    <div ref={rootRef} className="scroll-mt-4 rounded-2xl shadow-sm">
      <button
        type="button"
        onClick={() => {
          onSelect?.(dayNumber);
          if (!isControlled) setInternalExpanded((value) => !value);
        }}
        className={[
          "flex w-full items-center justify-between border border-[#CBDDE3] bg-white px-5 py-4 transition-colors hover:bg-gray-50/80",
          expanded ? "rounded-t-2xl border-b" : "rounded-2xl",
        ].join(" ")}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <span className="shrink-0 rounded-full bg-[#0878CF]/10 px-3 py-1 font-body text-[13px] font-bold leading-none text-[#075B85]">
            DÍA {dayNumber}
          </span>
          <div className="flex flex-col items-start gap-0.5">
            <span className="font-body text-base font-bold leading-none text-[#183F51]">{date}</span>
            <span className="font-body text-sm leading-none text-[#526C79]">
              {sorted.length === 0
                ? "Sin actividades"
                : `${sorted.length} actividad${sorted.length === 1 ? "" : "es"}`}
            </span>
          </div>
        </div>
        <span
          className={["text-[#526C79] transition-transform duration-300", expanded ? "rotate-180" : "rotate-0"].join(" ")}
          aria-hidden="true"
        >
          <IconChevron />
        </span>
      </button>

      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: expanded ? "9999px" : 0 }}
      >
        <div className="space-y-3 rounded-b-2xl border-x border-b border-[#CBDDE3] bg-white px-5 pb-5 pt-4">
          {sorted.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#91DEF0] bg-[#F4F9FA] px-5 py-6 text-center">
              <p className="font-heading text-base font-bold text-[#073B52]">
                Aún no hay actividades para este día
              </p>
              <p className="mt-1 font-body text-sm text-[#526C79]">
                {isPastDay
                  ? "Este día ya pasó; el itinerario queda como consulta."
                  : "Agrega lo que el grupo tiene planeado: horario, lugar y notas."}
              </p>
            </div>
          )}

          {sorted.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              canManage={
                !isPastDay &&
                (isAdmin || String(activity.createdBy ?? "") === String(currentUserId ?? ""))
              }
              onEdit={onEdit}
              onDelete={onDelete}
              onOpenBudget={onOpenBudget}
              onOpenVault={onOpenVault}
              actionsDisabled={actionsDisabled}
              actionsDisabledReason={actionsDisabledReason}
            />
          ))}

          {canAdd && (
            <button
              type="button"
              onClick={() => onAddActivity?.(dayNumber)}
              disabled={actionsDisabled}
              title={actionsDisabled ? actionsDisabledReason : undefined}
              className="group inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#91DEF0] bg-white px-4 py-3 transition-colors hover:border-[#0878CF]/50 hover:bg-[#E8F4FA] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="text-[#526C79] transition-colors group-hover:text-[#075B85]">
                <IconPlus />
              </span>
              <span className="font-body text-sm font-semibold text-[#526C79] transition-colors group-hover:text-[#075B85]">
                Agregar actividad
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
