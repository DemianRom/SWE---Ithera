import { useEffect, useMemo, useRef, useState } from "react";
import {
  GOOGLE_MAPS_MAP_ID,
  getDestinationArea,
  getPlaceLocation,
  googleMapsPlaceUrl,
  importGoogleLibrary,
  onGoogleMapsAuthFailure,
} from "../../../lib/googleMaps";

export interface TripMapActivity {
  id: string;
  title: string;
  /** Texto del pin (orden en el día, o número de día en la vista general). */
  glyph: string;
  /** Contexto para la ventana de información, p. ej. "Día 2 · 10:00". */
  caption: string;
  location?: string | null;
  placeId?: string | null;
}

export interface TripMapProps {
  activities: TripMapActivity[];
  /** Destino del viaje (texto libre): centra el mapa si ninguna actividad tiene lugar. */
  destination?: string | null;
  className?: string;
  /** Falla de Google (llave rechazada, script bloqueado): el padre muestra otra cosa. */
  onUnavailable?: () => void;
}

type MapStatus = "loading" | "ready" | "empty";

interface Plan {
  destination: string;
  activities: TripMapActivity[];
}

const DEFAULT_CENTER = { lat: 19.4326, lng: -99.1332 }; // Ciudad de México
const PIN_COLOR = "#1E6FD9";

function buildInfoContent(activity: TripMapActivity): HTMLElement {
  const root = document.createElement("div");
  root.style.cssText = "font-family: inherit; max-width: 220px; padding: 2px 2px 0;";

  const caption = document.createElement("p");
  caption.textContent = activity.caption;
  caption.style.cssText = "margin:0 0 2px; font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase;";

  const title = document.createElement("p");
  title.textContent = activity.title;
  title.style.cssText = "margin:0; font-size:14px; font-weight:800; color:#1E0A4E;";

  root.append(caption, title);

  if (activity.location) {
    const link = document.createElement("a");
    link.href = googleMapsPlaceUrl(activity.location, activity.placeId);
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = `${activity.location} ↗`;
    link.style.cssText = "display:block; margin-top:6px; font-size:12px; font-weight:600; color:#1E6FD9; text-decoration:none;";
    root.append(link);
  }
  return root;
}

/** Mapa de Google con las actividades (que tengan lugar) del día o del viaje. */
export function TripMap({ activities, destination, className = "", onUnavailable }: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const onUnavailableRef = useRef(onUnavailable);
  const [mapReady, setMapReady] = useState(false);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [placedCount, setPlacedCount] = useState(0);

  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  }, [onUnavailable]);

  useEffect(() => onGoogleMapsAuthFailure(() => onUnavailableRef.current?.()), []);

  // Cadena estable: el efecto de los pines solo corre si cambia el contenido,
  // no cada vez que el padre vuelve a renderizar (no reinicia el zoom del usuario).
  const plan = useMemo(
    () => JSON.stringify({ destination: destination?.trim() ?? "", activities } satisfies Plan),
    [activities, destination],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { Map, InfoWindow } = await importGoogleLibrary("maps");
      if (cancelled || !containerRef.current) return;
      mapRef.current = new Map(containerRef.current, {
        mapId: GOOGLE_MAPS_MAP_ID,
        center: DEFAULT_CENTER,
        zoom: 11,
        disableDefaultUI: true,
        zoomControl: true,
        fullscreenControl: true,
        gestureHandling: "cooperative",
        clickableIcons: false,
      });
      infoRef.current = new InfoWindow();
      setMapReady(true);
    })().catch((error: unknown) => {
      if (cancelled) return;
      console.warn("Google Maps: no se pudo crear el mapa", error);
      onUnavailableRef.current?.();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    let cancelled = false;
    const { destination: destinationText, activities: planned } = JSON.parse(plan) as Plan;

    (async () => {
      const { AdvancedMarkerElement, PinElement } = await importGoogleLibrary("marker");
      const located = await Promise.all(
        planned.map(async (activity) => ({
          activity,
          position: activity.placeId ? await getPlaceLocation(activity.placeId) : null,
        })),
      );
      if (cancelled) return;

      markersRef.current.forEach((marker) => {
        marker.map = null;
      });
      markersRef.current = [];
      infoRef.current?.close();

      const placed = located.filter(
        (item): item is { activity: TripMapActivity; position: google.maps.LatLngLiteral } => item.position !== null,
      );

      if (placed.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        for (const { activity, position } of placed) {
          const pin = new PinElement({
            glyphText: activity.glyph,
            background: PIN_COLOR,
            borderColor: "#FFFFFF",
            glyphColor: "#FFFFFF",
          });
          const marker = new AdvancedMarkerElement({
            map,
            position,
            title: `${activity.caption} · ${activity.title}`,
            content: pin,
            gmpClickable: true,
          });
          marker.addEventListener("gmp-click", () => {
            infoRef.current?.setContent(buildInfoContent(activity));
            infoRef.current?.open({ map, anchor: marker });
          });
          markersRef.current.push(marker);
          bounds.extend(position);
        }
        if (placed.length === 1) {
          map.setCenter(placed[0].position);
          map.setZoom(15);
        } else {
          map.fitBounds(bounds, 56);
        }
        setPlacedCount(placed.length);
        setStatus("ready");
        return;
      }

      const area = destinationText ? await getDestinationArea(destinationText) : null;
      if (cancelled) return;
      if (area) {
        if (area.bounds) map.fitBounds(area.bounds, 0);
        else {
          map.setCenter(area.center);
          map.setZoom(12);
        }
      }
      setPlacedCount(0);
      setStatus(area ? "ready" : "empty");
    })().catch((error: unknown) => {
      if (cancelled) return;
      console.warn("Google Maps: no se pudieron mostrar las actividades", error);
      onUnavailableRef.current?.();
    });

    return () => {
      cancelled = true;
    };
  }, [plan, mapReady]);

  const total = activities.length;
  const missing = total - placedCount;
  const chip =
    status !== "ready"
      ? null
      : total === 0
        ? "Agrega actividades con un lugar sugerido para verlas aquí"
        : placedCount === 0
          ? "Elige un lugar sugerido en tus actividades para verlas en el mapa"
          : missing > 0
            ? `${placedCount} de ${total} actividades en el mapa`
            : `${placedCount} ${placedCount === 1 ? "actividad" : "actividades"} en el mapa`;

  return (
    <div className={`relative overflow-hidden bg-[#E8EEF7] ${className}`}>
      <div ref={containerRef} className="absolute inset-0" aria-label="Mapa de las actividades del viaje" />

      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#E8EEF7]">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#CBD5E1] border-t-[#1E6FD9]" />
        </div>
      )}

      {status === "empty" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#EEF4FF] px-6 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#1E6FD9] shadow-sm">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
            </svg>
          </span>
          <p className="max-w-xs font-body text-sm font-semibold text-[#1E0A4E]">
            Elige un lugar sugerido al agregar una actividad para verla en el mapa.
          </p>
        </div>
      )}

      {chip && (
        <span className="pointer-events-none absolute bottom-3 left-3 max-w-[calc(100%-5rem)] rounded-full bg-white/95 px-3 py-1.5 font-body text-xs font-semibold text-[#1E0A4E] shadow-md">
          {chip}
        </span>
      )}
    </div>
  );
}
