// Google Maps Platform (Maps JavaScript API + Places API) cargado bajo demanda.
//
// El estudio COCOMO cuenta Google Places como Archivo de Interfaz Externa: la app
// consulta lugares para ubicar las actividades del itinerario, sin modificar el
// catálogo de Google. Solo se guarda el Place ID (lo único que los términos de
// Google permiten conservar sin límite); las coordenadas se consultan al dibujar
// el mapa y se guardan en memoria durante la sesión.
//
// Sin VITE_GOOGLE_MAPS_API_KEY (o si Google rechaza la llave) la app funciona
// igual: la ubicación es texto libre y el itinerario muestra la foto de portada.
import { useSyncExternalStore } from 'react'

const API_KEY = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim()

/** Map ID para los marcadores avanzados; DEMO_MAP_ID sirve mientras no haya uno propio. */
export const GOOGLE_MAPS_MAP_ID =
  String(import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? '').trim() || 'DEMO_MAP_ID'

const CALLBACK_NAME = '__travelingGoogleMapsReady'
const AREA_STORAGE_PREFIX = 'traveling_maps_area:'

declare global {
  interface Window {
    /** Google la llama si la llave es inválida, no permite este dominio o falta facturación. */
    gm_authFailure?: () => void
    __travelingGoogleMapsReady?: () => void
  }
}

// ── Disponibilidad ──────────────────────────────────────────────────────────

let authFailed = false
const availabilityListeners = new Set<() => void>()

export const isGoogleMapsEnabled = (): boolean => API_KEY.length > 0 && !authFailed

const subscribeAvailability = (listener: () => void): (() => void) => {
  availabilityListeners.add(listener)
  return () => {
    availabilityListeners.delete(listener)
  }
}

/** true mientras haya llave y Google no la haya rechazado. */
export const useGoogleMapsAvailable = (): boolean =>
  useSyncExternalStore(subscribeAvailability, isGoogleMapsEnabled, () => false)

/** Avisa si Google rechaza la llave después de cargar (el mapa queda inservible). */
export const onGoogleMapsAuthFailure = (listener: () => void): (() => void) =>
  subscribeAvailability(() => {
    if (authFailed) listener()
  })

const markAuthFailure = () => {
  if (authFailed) return
  authFailed = true
  console.warn('Google Maps rechazó la llave (dominio no permitido, API sin habilitar o sin facturación).')
  availabilityListeners.forEach((listener) => listener())
}

// ── Carga del script ────────────────────────────────────────────────────────

let loadPromise: Promise<void> | null = null

export function loadGoogleMaps(): Promise<void> {
  if (!isGoogleMapsEnabled()) {
    return Promise.reject(new Error('Google Maps no está configurado'))
  }
  if (typeof google !== 'undefined' && typeof google.maps?.importLibrary === 'function') {
    return Promise.resolve()
  }
  if (loadPromise) return loadPromise

  loadPromise = new Promise<void>((resolve, reject) => {
    window.gm_authFailure = markAuthFailure
    window.__travelingGoogleMapsReady = () => {
      delete window.__travelingGoogleMapsReady
      resolve()
    }

    const params = new URLSearchParams({
      key: API_KEY,
      v: 'weekly',
      loading: 'async',
      language: 'es',
      region: 'MX',
      callback: CALLBACK_NAME,
    })
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`
    script.async = true
    script.onerror = () => {
      script.remove()
      loadPromise = null
      reject(new Error('No se pudo cargar Google Maps'))
    }
    document.head.appendChild(script)
  })
  return loadPromise
}

export async function importGoogleLibrary<K extends keyof google.maps.ImportLibraryMap>(
  name: K,
): Promise<google.maps.ImportLibraryMap[K]> {
  await loadGoogleMaps()
  return google.maps.importLibrary(name)
}

// ── Coordenadas de un lugar (por Place ID) ──────────────────────────────────

const placeLocations = new Map<string, Promise<google.maps.LatLngLiteral | null>>()

/** Coordenadas de un Place ID; la consulta se hace una vez por sesión. */
export function getPlaceLocation(placeId: string): Promise<google.maps.LatLngLiteral | null> {
  let pending = placeLocations.get(placeId)
  if (!pending) {
    pending = (async () => {
      const { Place } = await importGoogleLibrary('places')
      const place = new Place({ id: placeId })
      await place.fetchFields({ fields: ['location'] })
      return place.location ? place.location.toJSON() : null
    })().catch((error: unknown) => {
      placeLocations.delete(placeId)
      console.warn('Google Places: no se pudo ubicar el lugar', placeId, error)
      return null
    })
    placeLocations.set(placeId, pending)
  }
  return pending
}

/** Guarda en memoria las coordenadas que ya trajo la búsqueda (evita repetir la consulta). */
export function rememberPlaceLocation(placeId: string, location: google.maps.LatLngLiteral): void {
  placeLocations.set(placeId, Promise.resolve(location))
}

// ── Área del destino (texto libre del viaje) ────────────────────────────────

export interface PlaceArea {
  center: google.maps.LatLngLiteral
  bounds: google.maps.LatLngBoundsLiteral | null
}

const destinationAreas = new Map<string, Promise<PlaceArea | null>>()

const readStoredArea = (key: string): PlaceArea | null => {
  try {
    const raw = sessionStorage.getItem(AREA_STORAGE_PREFIX + key)
    return raw ? (JSON.parse(raw) as PlaceArea) : null
  } catch {
    return null
  }
}

const storeArea = (key: string, area: PlaceArea): void => {
  try {
    sessionStorage.setItem(AREA_STORAGE_PREFIX + key, JSON.stringify(area))
  } catch {
    // Sin sessionStorage (modo privado): basta con la caché en memoria.
  }
}

/** Centro y límites del destino del viaje, para centrar el mapa y sesgar la búsqueda. */
export function getDestinationArea(destination: string): Promise<PlaceArea | null> {
  const key = destination.trim().toLowerCase()
  if (!key) return Promise.resolve(null)

  let pending = destinationAreas.get(key)
  if (!pending) {
    const stored = readStoredArea(key)
    pending = stored
      ? Promise.resolve(stored)
      : (async () => {
          const { Place } = await importGoogleLibrary('places')
          const { places } = await Place.searchByText({
            textQuery: destination.trim(),
            fields: ['location', 'viewport'],
            maxResultCount: 1,
            language: 'es',
          })
          const place = places[0]
          if (!place?.location) return null
          const area: PlaceArea = {
            center: place.location.toJSON(),
            bounds: place.viewport ? place.viewport.toJSON() : null,
          }
          storeArea(key, area)
          return area
        })().catch((error: unknown) => {
          destinationAreas.delete(key)
          console.warn('Google Places: no se pudo ubicar el destino', destination, error)
          return null
        })
    destinationAreas.set(key, pending)
  }
  return pending
}

// ── Enlaces ─────────────────────────────────────────────────────────────────

/** Abre Google Maps en el lugar exacto si hay Place ID; si no, busca el texto. */
export function googleMapsPlaceUrl(label: string, placeId?: string | null): string {
  const params = new URLSearchParams({ api: '1', query: label })
  if (placeId) params.set('query_place_id', placeId)
  return `https://www.google.com/maps/search/?${params.toString()}`
}
