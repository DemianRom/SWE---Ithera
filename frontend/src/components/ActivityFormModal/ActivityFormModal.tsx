import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Activity } from "../ui/DayView";
import { PlaceAutocompleteInput } from "../ui/PlaceAutocompleteInput";
import { Select } from "../ui/Select";

// Ciudad de México usa UTC-6 todo el año (sin horario de verano desde 2022).
const MEXICO_CITY_OFFSET = "-06:00";
const TIME_ZONE = "America/Mexico_City";

const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
});

export interface ActivityFormValues {
  titulo: string;
  descripcion: string | null;
  ubicacion: string | null;
  /** Place ID de Google Places si se eligió un lugar sugerido. */
  place_id: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
}

interface ActivityFormModalProps {
  open: boolean;
  /** Actividad a editar; sin ella el formulario crea una nueva. */
  activity?: Activity | null;
  /** Día propuesto (YYYY-MM-DD) al crear. */
  defaultDate: string | null;
  /** Rango permitido (YYYY-MM-DD). */
  minDate: string | null;
  maxDate: string | null;
  /** Destino del viaje: sesga las sugerencias de lugares hacia esa zona. */
  destination?: string | null;
  onClose: () => void;
  onSubmit: (values: ActivityFormValues) => Promise<void>;
}

const toLocalParts = (iso?: string | null): { date: string; time: string } | null => {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(parsed)
      .map((part) => [part.type, part.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
};

const toIso = (date: string, time: string): string =>
  new Date(`${date}T${time}:00${MEXICO_CITY_OFFSET}`).toISOString();

const inputClass =
  "w-full rounded-xl border border-[#E2E8F0] bg-white px-4 py-2.5 font-body text-sm text-[#1E0A4E] outline-none transition focus:border-[#1E6FD9] focus:ring-2 focus:ring-[#1E6FD9]/15 disabled:bg-[#F8FAFC]";
const labelClass = "mb-1.5 block font-body text-xs font-semibold uppercase tracking-wide text-[#1E0A4E]/60";

export function ActivityFormModal({
  open,
  activity,
  defaultDate,
  minDate,
  maxDate,
  destination,
  onClose,
  onSubmit,
}: ActivityFormModalProps) {
  const isEditing = Boolean(activity);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(saving);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    savingRef.current = saving;
    onCloseRef.current = onClose;
    if (saving && (!formRef.current?.contains(document.activeElement) ||
      (document.activeElement instanceof HTMLButtonElement && document.activeElement.disabled))) {
      titleRef.current?.focus();
    }
  }, [saving, onClose]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const form = formRef.current;
    if (!form) return;

    titleRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        if (!savingRef.current) {
          event.preventDefault();
          onCloseRef.current();
        }
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(form.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => !element.hidden && element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!first || !last) {
        event.preventDefault();
        form.focus();
      } else if (event.shiftKey && (active === first || !form.contains(active) || active === form)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !form.contains(active) || active === form)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const start = toLocalParts(activity?.startsAt);
    const end = toLocalParts(activity?.endsAt);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTitle(activity?.title ?? "");
    setDate(start?.date ?? defaultDate ?? minDate ?? "");
    setStartTime(start?.time ?? "10:00");
    setEndTime(end?.time ?? "");
    setLocation(activity?.location ?? "");
    setPlaceId(activity?.placeId ?? null);
    setDescription(activity?.description ?? "");
    setError("");
    setSaving(false);
  }, [open, activity, defaultDate, minDate]);

  const endOptions = useMemo(
    () => TIME_OPTIONS.filter((option) => option > startTime),
    [startTime],
  );

  if (!open) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return setError("Escribe un título para la actividad.");
    if (!date) return setError("Elige el día de la actividad.");
    if (endTime && endTime <= startTime) return setError("La hora de fin debe ser posterior a la de inicio.");

    setSaving(true);
    setError("");
    try {
      await onSubmit({
        titulo: title.trim(),
        descripcion: description.trim() || null,
        ubicacion: location.trim() || null,
        place_id: location.trim() ? placeId : null,
        fecha_inicio: toIso(date, startTime),
        fecha_fin: endTime ? toIso(date, endTime) : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la actividad.");
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-form-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <form
        ref={formRef}
        tabIndex={-1}
        onSubmit={handleSubmit}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[28px] border border-white/80 bg-white p-6 shadow-2xl shadow-[#1E0A4E]/20 ring-1 ring-[#E2E8F0]/70"
      >
        <h2 id="activity-form-title" className="font-heading text-lg font-extrabold text-[#1E0A4E]">
          {isEditing ? "Editar actividad" : "Agregar actividad"}
        </h2>
        <p className="mt-1 font-body text-sm text-[#64748B]">
          Las horas son de la Ciudad de México y van en intervalos de 30 minutos.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="activity-title" className={labelClass}>Título</label>
            <input
              ref={titleRef}
              id="activity-title"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Visita a Monte Albán"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="activity-date" className={labelClass}>Día</label>
              <input
                id="activity-date"
                type="date"
                value={date}
                min={minDate ?? undefined}
                max={maxDate ?? undefined}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="activity-start" className={labelClass}>Inicio</label>
              <Select
                id="activity-start"
                className="h-11"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  if (endTime && endTime <= e.target.value) setEndTime("");
                }}
              >
                {TIME_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="activity-end" className={labelClass}>Fin (opcional)</label>
              <Select
                id="activity-end"
                className="h-11"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              >
                <option value="">Sin hora de fin</option>
                {endOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label htmlFor="activity-location" className={labelClass}>Ubicación (opcional)</label>
            <PlaceAutocompleteInput
              id="activity-location"
              value={location}
              placeId={placeId}
              biasQuery={destination}
              maxLength={200}
              onChange={(next) => {
                setLocation(next.label);
                setPlaceId(next.placeId);
              }}
              placeholder="Ej: Monte Albán, Oaxaca"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="activity-description" className={labelClass}>Notas (opcional)</label>
            <textarea
              id="activity-description"
              value={description}
              maxLength={500}
              rows={3}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Punto de encuentro, qué llevar, reservaciones…"
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 font-body text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl border border-[#E2E8F0] px-4 py-2.5 font-body text-sm font-extrabold text-[#1E0A4E] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center rounded-xl bg-[#1E6FD9] px-4 py-2.5 font-body text-sm font-extrabold text-white transition hover:bg-[#2C8BE6] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Guardando…" : isEditing ? "Guardar cambios" : "Agregar actividad"}
          </button>
        </div>
      </form>
    </div>
  );
}
