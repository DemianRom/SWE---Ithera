const express = require('express');
const cors = require('cors');
import { createServer } from 'http';

import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler.middleware';
import authRouter from './routes/auth.router';
import tripsRouter from './routes/trips.router';
import budgetRouter from './routes/budget.router';
import notificationsRouter from './routes/notifications.router';
import documentsRouter from './routes/documents.router';
import contextLinksRouter from './routes/context-links.router';
import exportRouter from './routes/export.router';
import { initSocketServer } from './infrastructure/sockets/socket.server';

const app = express();
const httpServer = createServer(app);

// Detrás del reverse proxy (Caddy): confiar en X-Forwarded-* del primer salto.
app.set('trust proxy', 1);

const allowedOrigins = [
  env.FRONTEND_URL,
  'http://localhost:5173',
];

app.use(cors({
  origin: (origin: string | undefined, callback: any) => {
    if (!origin) {
      return callback(null, true);
    }

    const isAllowed = allowedOrigins.includes(origin);

    if (isAllowed) {
      return callback(null, true);
    }

    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json());

app.get('/health', (_req: any, res: any) => {
  res.status(200).json({
    ok: true,
    message: 'ITHERA backend funcionando',
    env: env.NODE_ENV
  });
});

app.use('/api/auth', authRouter);
app.use('/api/groups/:groupId/context-links', contextLinksRouter);
app.use('/api/groups/:groupId/documents', documentsRouter);
app.use('/api/groups/:groupId/vault', documentsRouter);
app.use('/api/groups', tripsRouter);
app.use('/api/budget', budgetRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/export', exportRouter);
app.use(errorHandler);

// ── Socket.IO ─────────────────────────────────────────────────────
initSocketServer(httpServer);

// ── Arranque ──────────────────────────────────────────────────────
httpServer.listen(env.PORT, () => {
  console.log(`ITHERA backend corriendo en http://localhost:${env.PORT}`);
  console.log(`Entorno: ${env.NODE_ENV}`);
  console.log(`Socket.IO corriendo en el mismo puerto (${env.PORT})`);
});

export default app;
