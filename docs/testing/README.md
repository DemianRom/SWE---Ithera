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
SMOKE_API_URL=http://localhost:3001/api \
SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SECRET_KEY=... \
npm run smoke
```

Se corre en local antes de cada despliegue con cambios de backend o de esquema, y en produccion
despues de desplegar.

## Concurrencia de pagos en Supabase local

La prueba monta las rutas reales de autenticación y presupuesto en una API de prueba ligada
a `127.0.0.1`. Confirma en PostgreSQL que dos solicitudes están esperando por el mismo pago
antes de liberar el bloqueo. Comprueba ambos órdenes de edición o borrado frente a confirmación,
los saldos, los comprobantes y los permisos de la función de base de datos.

1. Instala las dependencias en la raíz y en `backend`. Usa un contexto local de Docker.
2. En un directorio nuevo y separado, inicializa Supabase con
   `npx --no-install supabase --workdir <directorio-aislado> init` desde la raíz del repositorio.
   Copia `supabase/migrations/` del repositorio a `<directorio-aislado>/supabase/migrations/`.
3. En el `config.toml` de la copia local, fija `project_id = "traveling-payment-race"` y usa
   puertos locales libres en las secciones de servicios habilitados. Inicia esa copia con
   `npx --no-install supabase --workdir <directorio-aislado> start`. Si ya existe una pila
   dedicada con ese nombre y las migraciones aplicadas, usa su directorio.
4. Ejecuta estos comandos desde la raíz.

```sh
npm run build --prefix backend
node backend/scripts/payment-race.mjs "<directorio-aislado>"
```

El script lee las claves de la pila dedicada mediante la CLI local sin imprimirlas. Verifica
el directorio y los contenedores antes de crear datos y limpia los usuarios y el viaje que creó
al terminar.

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
