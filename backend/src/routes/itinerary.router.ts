import { Router, Request, Response } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import * as ItineraryService from '../domain/itinerary/itinerary.service';

const router = Router({ mergeParams: true });

router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = req.params.groupId;

    if (!groupId) {
      res.status(400).json({ ok: false, error: 'groupId inválido' });
      return;
    }

    const result = await ItineraryService.getGroupItinerary(req.user!.id, groupId);

    res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    const status = (err as any).statusCode ?? 500;

    res.status(status).json({
      ok: false,
      error: msg,
    });
  }
});

router.post('/activities', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = req.params.groupId;

    if (!groupId) {
      res.status(400).json({ ok: false, error: 'groupId inválido' });
      return;
    }

    const { titulo, descripcion, ubicacion, place_id, fecha_inicio, fecha_fin } = req.body ?? {};
    const activity = await ItineraryService.createGroupActivity(req.user!.id, groupId, {
      titulo,
      descripcion,
      ubicacion,
      place_id,
      fecha_inicio,
      fecha_fin,
    });

    res.status(201).json({
      ok: true,
      message: 'Actividad creada correctamente',
      activity,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    const status = (err as any).statusCode ?? 500;

    res.status(status).json({
      ok: false,
      error: msg,
    });
  }
});

router.patch('/activities/:activityId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = req.params.groupId;
    const activityId = req.params.activityId;

    if (!groupId || !activityId) {
      res.status(400).json({ ok: false, error: 'groupId y activityId son requeridos' });
      return;
    }

    const { titulo, descripcion, ubicacion, place_id, fecha_inicio, fecha_fin } = req.body ?? {};
    const payload = Object.fromEntries(
      Object.entries({ titulo, descripcion, ubicacion, place_id, fecha_inicio, fecha_fin })
        .filter(([, value]) => value !== undefined),
    );
    const activity = await ItineraryService.updateGroupActivity(
      req.user!.id,
      groupId,
      activityId,
      payload
    );

    res.status(200).json({
      ok: true,
      message: 'Actividad actualizada correctamente',
      activity,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    const status = (err as any).statusCode ?? 500;

    res.status(status).json({
      ok: false,
      error: msg,
    });
  }
});


router.delete('/activities/:activityId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = req.params.groupId;
    const activityId = req.params.activityId;

    if (!groupId || !activityId) {
      res.status(400).json({ ok: false, error: 'groupId y activityId son requeridos' });
      return;
    }

    await ItineraryService.deleteGroupActivity(req.user!.id, groupId, activityId);

    res.status(200).json({ ok: true, message: 'Actividad eliminada correctamente' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    const status = (err as any).statusCode ?? 500;
    res.status(status).json({ ok: false, error: msg });
  }
});

export default router;
