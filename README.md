# Traveling

> Las cuentas compartidas de un viaje en grupo: quién pagó, cómo se reparte, cuánto falta y quién le debe a quién.

```text
Instituto Politecnico Nacional
Escuela Superior de Computo
Ingenieria en Sistemas Computacionales
Unidad de aprendizaje: Analisis y Diseno de Sistemas
Ciclo escolar: 2026/2
Grupo: 5CM3
Profesora: Idalia Maldonado
Equipo 2: Traveling
```

Produccion: **https://traveling.tonyquezada.com**

## Origen del proyecto

Traveling nace de **Ithera** ([ITHERAADS/ITHERA](https://github.com/ITHERAADS/ITHERA)), un proyecto
que se dividio en dos equipos con una base comun. Este repositorio es la version del **Equipo 2**,
enfocada en las cuentas compartidas del viaje. El Equipo 1 continua con la planificacion
colaborativa (busqueda de vuelos y hospedajes, propuestas y votaciones).

- **Base comun:** cuentas, creacion de viajes, integrantes, permisos e itinerario basico con
  actividades, horarios y ubicaciones.
- **Equipo 2 (este repo):** registrar gastos y quien pago, repartirlos entre los involucrados,
  presupuesto planeado vs. gastado, saldos y pagos entre companeros, comprobantes y resumenes.

Los gastos no necesitan estar ligados a una actividad: basta con crear un viaje y agregar
integrantes. El itinerario sirve como contexto opcional. El material oficial de Ithera se conserva
en [docs/legacy-ithera/](docs/legacy-ithera/README.md). El plan de la conversion esta en
[docs/plan-traveling.md](docs/plan-traveling.md).

## Modulos

| ID | Modulo | Backend | Frontend |
| --- | --- | --- | --- |
| M1 | Cuentas y acceso (OTP, Google, perfil) | `auth` | `Login`, `Register`, `OTP`, `Profile` |
| M2 | Viajes, integrantes y permisos | `groups` (`trips.router`) | `MyTrips`, `CreateGroup`, `JoinGroup`, `GroupPanel`, `GroupSettings` |
| M3 | Itinerario basico | `itinerary`, `export` | Pestana Itinerario (`DayView`, `ActivityFormModal`, `TripMap`, `PlaceAutocompleteInput`), `Shared` |
| M4 | Gastos y repartos | `budget` | Pestana Finanzas (`BudgetDashboard`, `RegisterExpenseModal`) |
| M5 | Presupuesto (total y por categoria) | `budget` | `CategoryBudgetPanel` |
| M6 | Saldos y pagos entre companeros | `budget` | `MyWalletView` |
| M7 | Comprobantes y resumenes | `documents`, `context-links`, `budget` (resumen, CSV, PDF) | Pestana Archivos, `BudgetSummaryPanel` |
| M8 | Notificaciones, chat y tiempo real | `notifications`, `groups/chat`, `infrastructure/sockets` | `Navbar`, `ChatDrawer`, `useSocket` |

## Stack

| Capa | Tecnologia |
| --- | --- |
| Backend | Node.js 24, TypeScript, Express, Socket.IO |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Recharts |
| Base de datos, auth y archivos | Supabase (Postgres, Auth con OTP y Google, Storage) |
| Correo | SMTP (Gmail con contrasena de aplicacion) |
| Hosting | Docker Compose + Caddy en servidor propio |
| CI/CD | GitHub Actions (CI y deploy por SSH) |
| Pruebas | Jest (backend) y smoke test de punta a punta |

La unica API externa es Google Maps Platform (desde el navegador): sugerencias de lugares de
Google Places al ubicar una actividad y mapa del itinerario. Es opcional; sin llave, la
ubicacion es texto libre. Ver [docs/maps/README.md](docs/maps/README.md).

## Arquitectura en breve

```text
Navegador ──> Caddy (TLS) ──┬── /api, /socket.io, /health ──> traveling-api (Express + Socket.IO)
                            └── todo lo demas ─────────────> traveling-web (nginx + build de Vite)
traveling-api ──> Supabase (secret key): Postgres, Auth, Storage
Navegador ──> Supabase Auth (publishable key): registro, login, OTP, Google
```

Detalle en [docs/architecture/README.md](docs/architecture/README.md).

## Estructura del repositorio

```text
.
|-- backend/                 # API Express + Socket.IO (TypeScript)
|   |-- src/
|   |   |-- config/          # Variables de entorno
|   |   |-- domain/          # Reglas de negocio por modulo
|   |   |-- infrastructure/  # Supabase, sockets, plantillas de correo
|   |   |-- middlewares/     # Autenticacion y errores
|   |   |-- routes/          # Routers Express
|   |   `-- services/        # Correo (SMTP)
|   |-- scripts/smoke.mjs    # Smoke test de punta a punta
|   |-- tests/               # Pruebas Jest
|   `-- Dockerfile
|-- frontend/                # React + Vite
|   |-- src/                 # pages, components, services, hooks, context, types
|   |-- Dockerfile
|   `-- nginx.conf
|-- supabase/                # Configuracion de Auth, plantillas y migraciones (Supabase CLI)
|-- docs/                    # Documentacion tecnica y academica
|-- compose.yaml             # Servicios de produccion
|-- deploy.sh                # Despliegue en el servidor
`-- .github/                 # CI, deploy, plantillas de issues y PR
```

## Instalacion local

Requisitos: Node.js 24, npm y acceso a un proyecto de Supabase (o la pila local de la CLI, ver
[docs/database/README.md](docs/database/README.md)).

```bash
npm install                     # instala la Supabase CLI fijada en la raiz

cd backend
npm install
cp .env.example .env            # Supabase, SMTP y SHARE_LINK_SECRET
npm run dev                     # http://localhost:3001  (/health, /api)

cd ../frontend
npm install
cp .env.example .env            # VITE_API_URL, Supabase publico, VITE_OAUTH_PROVIDERS
npm run dev                     # http://localhost:5173
```

## Scripts principales

| Donde | Comando | Que hace |
| --- | --- | --- |
| backend | `npm run dev` / `build` / `start` | Desarrollo, compilacion y arranque. |
| backend | `npm test` | Pruebas Jest. |
| backend | `SMOKE_API_URL=... npm run smoke` | Recorre todos los flujos contra un backend en ejecucion y limpia lo que crea. |
| frontend | `npm run dev` / `build` / `lint` / `preview` | Desarrollo, build, lint y vista previa. |
| raiz | `npx supabase db push` / `config push` | Aplica migraciones y configuracion de Auth. |

## Despliegue

Cada push a `main` ejecuta `.github/workflows/deploy.yml`, que entra por SSH al servidor y corre
`deploy.sh` (fast-forward y `docker compose up -d --build` de lo que cambio). Las migraciones de
base de datos se aplican aparte con la Supabase CLI. Guia completa:
[docs/deploy/README.md](docs/deploy/README.md).

## Documentacion

| Documento | Uso |
| --- | --- |
| [docs/README.md](docs/README.md) | Indice general. |
| [Kit de marca](docs/frontend-ui/kit-marca/README.md) | Manual visual HTML, tokens y logotipos para renovar el frontend. |
| [Fases del rediseño (TXT)](docs/frontend-ui/FASES_REDISENO_FRONTEND.txt) | Análisis del frontend, módulos, dependencias y criterios de aceptación. |
| [docs/plan-traveling.md](docs/plan-traveling.md) | Plan y bitacora de la conversion Ithera → Traveling. |
| [docs/api/endpoints.md](docs/api/endpoints.md) | Endpoints REST. |
| [docs/architecture/README.md](docs/architecture/README.md) | Arquitectura. |
| [docs/database/README.md](docs/database/README.md) | Supabase, migraciones, RLS y Auth como codigo. |
| [docs/deploy/README.md](docs/deploy/README.md) | Hosting y despliegue. |
| [docs/env/README.md](docs/env/README.md) | Variables de entorno. |
| [docs/realtime/README.md](docs/realtime/README.md) | Socket.IO. |
| [docs/maps/README.md](docs/maps/README.md) | Google Places y mapa del itinerario. |
| [docs/security/README.md](docs/security/README.md) | Seguridad. |
| [docs/testing/README.md](docs/testing/README.md) | Pruebas. |
| [docs/workflows/README.md](docs/workflows/README.md) | GitHub Actions. |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Reglas de trabajo del equipo. |

## GitFlow

| Rama | Proposito |
| --- | --- |
| `main` | Produccion: cada push se despliega. No recibe commits directos. |
| `develop` | Integracion. Todo entra por PR. |
| `feature/*`, `fix/*`, `docs/*`, `ci/*`, `refactor/*`, `chore/*` | Trabajo; salen de `develop` y vuelven por PR. |
| `release/*`, `hotfix/*` | Entregas y correcciones urgentes. |

Detalle en [docs/gitflow/README.md](docs/gitflow/README.md) y [CONTRIBUTING.md](CONTRIBUTING.md).
Arreglos de la base comun que publique el Equipo 1 se traen con `cherry-pick` desde
`upstream/develop` (remoto `ITHERAADS/ITHERA`, solo lectura).

## Reglas de oro

1. No hacer push directo a `main` ni a `develop`.
2. No hacer merge de tu propio PR.
3. Todo cambio relevante tiene issue y un PR que resuelve una cosa clara.
4. Todo endpoint nuevo se documenta en `docs/api/endpoints.md`.
5. Toda migracion va en `supabase/migrations/` y se prueba en local antes de `db push`.
6. Todo cambio de variable, workflow, evento realtime o regla de seguridad se documenta.
7. No subir `.env`, secretos, tokens ni credenciales.
8. No pedir merge con CI fallando; si hay cambios visuales, agregar evidencia en el PR.

## Equipo

Integrantes del Equipo 2: pendiente de completar (ver `.github/CODEOWNERS`). La base comun
proviene del equipo de Ithera; los creditos originales estan en
[docs/legacy-ithera/README.md](docs/legacy-ithera/README.md).

---

Proyecto academico de Analisis y Diseno de Sistemas - Ingenieria en Sistemas Computacionales - ESCOM IPN - Ciclo 2026/2 - Grupo 5CM3.
