import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  getDestinationArea,
  importGoogleLibrary,
  rememberPlaceLocation,
  useGoogleMapsAvailable,
} from "../../../lib/googleMaps";

export interface PlaceValue {
  /** Texto visible: nombre del lugar elegido o lo que escribió la persona. */
  label: string;
  /** Place ID de Google Places; null si la ubicación es texto libre. */
  placeId: string | null;
}

export interface PlaceAutocompleteInputProps {
  id: string;
  value: string;
  placeId: string | null;
  onChange: (value: PlaceValue) => void;
  /** Destino del viaje: las sugerencias cercanas aparecen primero. */
  biasQuery?: string | null;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}

interface Suggestion {
  placeId: string;
  main: string;
  secondary: string;
  prediction: google.maps.places.PlacePrediction;
}

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 300;
const MAX_SUGGESTIONS = 5;

/**
 * Campo de ubicación con sugerencias de Google Places (Archivo de Interfaz
 * Externa del estudio COCOMO). Sin llave de Google se comporta como un input
 * de texto normal.
 */
export function PlaceAutocompleteInput({
  id,
  value,
  placeId,
  onChange,
  biasQuery,
  placeholder,
  maxLength = 200,
  className = "",
}: PlaceAutocompleteInputProps) {
  const enabled = useGoogleMapsAvailable();
  const listId = useId();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState<string | null>(null);

  const sessionRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const requestRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const focusedRef = useRef(false);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const cancelPending = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    requestRef.current += 1;
  };

  const closeList = () => {
    setOpen(false);
    setHighlight(-1);
  };

  const fetchSuggestions = async (query: string) => {
    const requestId = ++requestRef.current;
    try {
      const { AutocompleteSessionToken, AutocompleteSuggestion } = await importGoogleLibrary("places");
      // Una sesión agrupa las búsquedas hasta elegir un lugar (así factura Google).
      sessionRef.current ??= new AutocompleteSessionToken();
      const area = biasQuery ? await getDestinationArea(biasQuery) : null;

      const request: google.maps.places.AutocompleteRequest = {
        input: query,
        sessionToken: sessionRef.current,
        language: "es",
        region: "mx",
      };
      if (area) request.locationBias = area.bounds ?? { center: area.center, radius: 30_000 };

      const { suggestions: results } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
      if (requestId !== requestRef.current) return;

      const items = results
        .map((result) => result.placePrediction)
        .filter((prediction): prediction is google.maps.places.PlacePrediction => prediction !== null)
        .slice(0, MAX_SUGGESTIONS)
        .map((prediction) => ({
          placeId: prediction.placeId,
          main: (prediction.mainText ?? prediction.text).toString(),
          secondary: prediction.secondaryText?.toString() ?? "",
          prediction,
        }));
      setSuggestions(items);
      setHighlight(-1);
      setOpen(focusedRef.current && items.length > 0);
    } catch (error) {
      if (requestId !== requestRef.current) return;
      console.warn("Google Places: no se pudieron obtener sugerencias", error);
      setSuggestions([]);
      setOpen(false);
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  };

  const handleType = (text: string) => {
    // Escribir suelta el lugar elegido: el texto ya no corresponde a él.
    onChange({ label: text, placeId: null });
    setAddress(null);
    if (!enabled) return;

    cancelPending();
    const query = text.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setLoading(false);
      closeList();
      return;
    }
    setLoading(true);
    timerRef.current = window.setTimeout(() => void fetchSuggestions(query), DEBOUNCE_MS);
  };

  const selectSuggestion = async (suggestion: Suggestion) => {
    cancelPending();
    closeList();
    setSuggestions([]);
    setLoading(false);
    try {
      // Cierra la sesión y trae nombre, dirección y coordenadas del lugar.
      const place = suggestion.prediction.toPlace();
      await place.fetchFields({ fields: ["displayName", "formattedAddress", "location"] });
      if (place.location) rememberPlaceLocation(place.id, place.location.toJSON());
      onChange({
        label: (place.displayName || suggestion.main).slice(0, maxLength),
        placeId: place.id || suggestion.placeId,
      });
      setAddress(place.formattedAddress || suggestion.secondary || null);
    } catch (error) {
      console.warn("Google Places: no se pudieron leer los datos del lugar", error);
      onChange({ label: suggestion.main.slice(0, maxLength), placeId: suggestion.placeId });
      setAddress(suggestion.secondary || null);
    } finally {
      sessionRef.current = null;
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === "Enter" && highlight >= 0) {
      event.preventDefault();
      void selectSuggestion(suggestions[highlight]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeList();
    }
  };

  const optionId = (index: number) => `${listId}-option-${index}`;

  return (
    <div>
      <div className="relative">
        <input
          id={id}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          autoComplete="off"
          className={className}
          onChange={(event) => handleType(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            focusedRef.current = true;
            if (suggestions.length > 0 && !placeId) setOpen(true);
          }}
          onBlur={() => {
            focusedRef.current = false;
            closeList();
          }}
          {...(enabled
            ? {
                role: "combobox",
                "aria-autocomplete": "list" as const,
                "aria-expanded": open,
                "aria-controls": listId,
                "aria-activedescendant": open && highlight >= 0 ? optionId(highlight) : undefined,
              }
            : {})}
        />
        {loading && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-[#CBD5E1] border-t-[#1E6FD9]"
          />
        )}
        {enabled && open && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Lugares sugeridos"
            className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white py-1 shadow-xl shadow-[#1E0A4E]/10"
          >
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion.placeId}
                id={optionId(index)}
                role="option"
                aria-selected={index === highlight}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => void selectSuggestion(suggestion)}
                className={`cursor-pointer px-3 py-2 ${index === highlight ? "bg-[#EEF4FF]" : ""}`}
              >
                <span className="block truncate font-body text-sm font-semibold text-[#1E0A4E]">
                  {suggestion.main}
                </span>
                {suggestion.secondary && (
                  <span className="block truncate font-body text-xs text-[#64748B]">{suggestion.secondary}</span>
                )}
              </li>
            ))}
            <li
              role="presentation"
              className="border-t border-[#F1F5F9] px-3 pb-1 pt-1.5 text-right text-[11px] text-[#64748B]"
              style={{ fontFamily: "Roboto, Arial, sans-serif" }}
            >
              Google Maps
            </li>
          </ul>
        )}
      </div>

      {enabled && placeId && (
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <span className="inline-flex min-w-0 items-center gap-1.5 font-body text-xs font-semibold text-[#047857]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
              <path
                d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="10" r="2.5" fill="currentColor" />
            </svg>
            <span className="truncate">{address ? `En el mapa · ${address}` : "En el mapa"}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              onChange({ label: value, placeId: null });
              setAddress(null);
            }}
            className="shrink-0 font-body text-xs font-semibold text-[#64748B] underline-offset-2 hover:text-[#1E0A4E] hover:underline"
          >
            Quitar del mapa
          </button>
        </div>
      )}
      {enabled && !placeId && value.trim().length >= MIN_QUERY_LENGTH && !open && !loading && (
        <p className="mt-1.5 font-body text-xs text-[#64748B]">
          Elige un lugar sugerido para que la actividad aparezca en el mapa.
        </p>
      )}
    </div>
  );
}
