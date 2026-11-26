# Testing - Traveling

Esta guia define como ejecutar y mantener las pruebas del proyecto.

## Estado actual

| Tipo | Donde | Que cubre |
| --- | --- | --- |
| Unitarias (Jest) | `backend/tests/budget.service.test.ts` | Repartos (equitativo, porcentual con redondeo a centavos y montos exactos), saldos, liquidaciones, presupuesto por categoria, viaje cerrado, alertas de presupuesto y CSV. |
| Unitarias (Jest) | `backend/tests/context-links.service.test.ts` | Enlaces contextuales por viaje. |
| Smoke de punta a punta | `backend/scripts/smoke.mjs` | Registro, viaje, integrantes, itinerario, gastos, saldos, pagos, presupuesto, resumen, CSV, PDF, archivos, chat, notificaciones y enlace publico, contra un backend real. Limpia lo que crea. |
| Auxiliares | `backend/tests/forgot-password-timing.mjs`, `backend/tests/db_stress.k6.js` | Tiempo de respuesta de recuperacion de contrasena y estres de base de datos (manuales). |

`backend/tests/setup.ts` prepara las variables de entorno de Jest.

## Comandos backend

```bash
cd backend
npm test -- --runInBand
npx tsc --noEmit
npm run build
```

## Smoke test

Requiere un backend en ejecucion y un proyecto de Supabase (la pila local de la CLI sirve; ver
[../database/README.md](../database/README.md)):

```bash
cd backend
SMOKE_API_URL=http://localhost:3001 \
SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SECRET_KEY=... \
npm run smoke
```

Se corre en local antes de cada despliegue con cambios de backend o de esquema, y en produccion
despues de desplegar.

## Comandos frontend

El frontend no tiene suite automatizada. La verificacion minima es:

```bash
cd frontend
npm run lint
npx tsc -b
npm run build
```

## Que probar

Agregar o actualizar pruebas cuando cambie:

- Logica de negocio en `backend/src/domain` (en especial repartos, saldos y presupuesto).
- Validaciones de permisos (admin, creador del gasto, acreedor del pago, viaje cerrado).
- Transformaciones de datos que afecten la API, el CSV o el PDF.
- Un flujo de punta a punta: agregarlo tambien al smoke test.

## Convenciones

- Tests unitarios en `backend/tests`, con mocks de Supabase.
- Sin credenciales reales en tests unitarios.
- Tests deterministas.

## Checklist antes de PR

- Backend: `npm test -- --runInBand` y `npx tsc --noEmit`.
- Frontend: `npm run lint` y `npm run build`.
- Cambios de API o esquema: smoke test local.
- Si no se puede correr algo, explicar el motivo en el PR.
