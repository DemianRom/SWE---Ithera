export type ItineraryActivityStatus = 'confirmada' | 'cancelada';

export interface ItineraryActivity {
  id: string;
  title: string;
  description: string;
  location?: string;
  /** Place ID de Google Places si la ubicación se eligió de las sugerencias. */
  placeId: string | null;
  /** Hora de inicio formateada (HH:mm, hora de Ciudad de México). */
  time: string;
  startsAt: string | null;
  endsAt: string | null;
  status: 'confirmada';
  createdBy: string | null;
  createdByName: string | null;
  // Campos de presentación que el frontend ya espera para cada tarjeta.
  category: 'actividad';
  price: number;
  currency: string;
  image: string;
}

export interface ItineraryDay {
  dayNumber: number;
  date: string;
  activities: ItineraryActivity[];
}

export interface ActivityPayload {
  titulo?: string | null;
  descripcion?: string | null;
  ubicacion?: string | null;
  /** Place ID de Google Places; null o ausente = ubicación en texto libre. */
  place_id?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
}
