import { supabaseAdmin } from '../../infrastructure/db/supabase.client';
import * as NotificationsService from '../notifications/notifications.service';
import { TripDocument } from './documents.entity';

const BUCKET = 'trip-documents';
// El bucket es privado: cada respuesta lleva una URL firmada temporal.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Agrega `file_url` firmada (válida una hora) a cada documento. */
async function withSignedUrls<T extends { file_path: string }>(docs: T[]): Promise<(T & { file_url: string | null })[]> {
  if (docs.length === 0) return [];
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrls(docs.map((doc) => doc.file_path), SIGNED_URL_TTL_SECONDS);
  if (error) throw new Error(`Error en Storage: ${error.message}`);
  const urlByPath = new Map((data ?? []).map((item) => [item.path, item.signedUrl]));
  return docs.map((doc) => ({ ...doc, file_url: urlByPath.get(doc.file_path) ?? null }));
}

/** Verifica si un usuario pertenece al grupo antes de cualquier operación */
async function assertUserIsMember(tripId: string | number, userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('grupo_miembros')
    .select('id, usuarios!inner(auth_user_id)')
    .eq('grupo_id', tripId)
    .eq('usuarios.auth_user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('No tienes acceso a este grupo de viaje');
}

export const uploadDocument = async (data: {
  tripId: string | number;
  userId: string;
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  fileSize: number;
  category: string;
  metadata?: Record<string, unknown>;
}): Promise<TripDocument> => {
  await assertUserIsMember(data.tripId, data.userId);

  const timestamp = Date.now();
  const safeName = data.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${data.tripId}/${timestamp}-${safeName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, data.fileBuffer, {
      contentType: data.mimeType,
      upsert: false,
    });

  if (uploadError) throw new Error(`Error en Storage: ${uploadError.message}`);

  const { data: doc, error: dbError } = await supabaseAdmin
    .from('trip_documents')
    .insert({
      trip_id: data.tripId,
      user_id: data.userId,
      file_name: data.fileName,
      file_path: storagePath,
      mime_type: data.mimeType,
      file_size: data.fileSize,
      category: data.category,
      metadata: data.metadata ?? {},
    })
    .select()
    .single();

  if (dbError) {
    await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
    throw dbError;
  }

  NotificationsService.emitGroupDashboardUpdated(Number(data.tripId), {
    tipo: 'documento_subido',
    entidadTipo: 'documento',
    entidadId: null,
    actorUsuarioId: null,
    metadata: {
      itemTitle: data.fileName,
      itemType: 'documento',
      category: data.category,
      documentId: String((doc as any).id),
    },
  });

  const [signed] = await withSignedUrls([doc as TripDocument]);
  return signed;
};

export const getDocumentsByTrip = async (
  tripId: string | number,
  userId: string
): Promise<TripDocument[]> => {
  await assertUserIsMember(tripId, userId);

  const { data, error } = await supabaseAdmin
    .from('trip_documents')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return withSignedUrls((data ?? []) as TripDocument[]);
};

export const deleteDocument = async (
  docId: string,
  tripId: string | number,
  userId: string
): Promise<void> => {
  await assertUserIsMember(tripId, userId);

  const { data: doc, error: fetchError } = await supabaseAdmin
    .from('trip_documents')
    .select('*')
    .eq('id', docId)
    .eq('trip_id', tripId)
    .single();

  if (fetchError || !doc) throw new Error('Documento no encontrado');
  if (doc.user_id !== userId) throw new Error('Solo el autor puede eliminar el documento');
  if (doc.metadata && typeof doc.metadata === 'object' && (doc.metadata as Record<string, unknown>).immutable === true) {
    throw new Error('Este documento es inmutable y no puede eliminarse');
  }

  await supabaseAdmin.storage.from(BUCKET).remove([doc.file_path]);
  await supabaseAdmin.from('trip_documents').delete().eq('id', docId);

  NotificationsService.emitGroupDashboardUpdated(Number(tripId), {
    tipo: 'documento_eliminado',
    entidadTipo: 'documento',
    entidadId: null,
    actorUsuarioId: null,
    metadata: {
      itemTitle: doc.file_name ?? 'Documento',
      itemType: 'documento',
      documentId: docId,
    },
  });
};
