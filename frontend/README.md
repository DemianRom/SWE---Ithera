# Frontend - Traveling

Frontend de Traveling construido con React, TypeScript, Vite y Tailwind CSS. Contiene la landing,
las pantallas de cuenta, la lista de viajes y el panel de cada viaje con sus pestanas de Finanzas,
Itinerario y Archivos.

## Responsabilidades

- Renderizar la experiencia web de Traveling.
- Autenticar con Supabase Auth (correo con codigo OTP y Google).
- Consumir la API del backend por modulo (`src/services`).
- Mantener el estado de sesion y del viaje actual.
- Escuchar eventos de Socket.IO para chat, notificaciones y refresco del panel.
- Construir el bundle estatico que sirve nginx en produccion.

## Stack

| Area | Tecnologia |
| --- | --- |
| UI | React 19 |
| Lenguaje | TypeScript |
| Build | Vite |
| Estilos | Tailwind CSS |
| Rutas | React Router |
| Graficas | Recharts |
| Auth | Supabase JS |
| Tiempo real | Socket.IO client |
| Produccion | nginx (`Dockerfile`, `nginx.conf`) |

## Estructura

```text
frontend/
|-- public/favicon.svg            # Icono de Traveling
|-- src/
|   |-- App.tsx                   # Rutas
|   |-- main.tsx                  # Entrada
|   |-- assets/                   # Iconos de proveedores (Google, Facebook)
|   |-- components/
|   |   |-- ActivityFormModal/    # Alta y edicion de actividades
|   |   |-- auth/                 # ProtectedRoute, PublicRoute
|   |   |-- budget/               # Finanzas: gastos, saldos, pagos, presupuesto y resumen
|   |   |-- chat/                 # ChatDrawer
|   |   |-- documents/            # Comprobantes del viaje
|   |   |-- GroupConfigModal/     # Configuracion del viaje
|   |   |-- InviteModal/          # Invitaciones y QR
|   |   |-- layout/               # Navbar, Sidebar, Footer, AppLayout
|   |   `-- ui/                   # Primitivos (Button, Card, DayView, Logo, Toast...)
|   |-- constants/
|   |-- context/                  # AuthContext, TripContext
|   |-- hooks/                    # useSocket, useGroupRealtimeRefresh, useNotifications...
|   |-- lib/                      # Cliente de Supabase y proveedores OAuth
|   |-- pages/                    # Una carpeta por ruta
|   |-- services/                 # Clientes HTTP por modulo
|   `-- types/
|-- Dockerfile                    # Build con Vite y nginx
`-- nginx.conf                    # SPA fallback y cache de assets
```

## Rutas principales

Las rutas se registran en `src/App.tsx`.

| Ruta | Vista | Acceso |
| --- | --- | --- |
| `/` | Landing | Publico |
| `/login` | Login | Solo publico |
| `/register` | Registro | Solo publico |
| `/forgot-password` | Recuperacion | Solo publico |
| `/reset-password` | Nueva contrasena | Publico |
| `/otp` | Verificacion con codigo | Publico |
| `/join-group` | Unirse a un viaje | Publico |
| `/shared/:token` | Itinerario publico (solo lectura) | Publico |
| `/my-trips` | Mis viajes | Protegido |
| `/create-group` | Crear viaje (presupuesto opcional) | Protegido |
| `/dashboard` | Panel del viaje: Finanzas, Itinerario y Archivos | Protegido |
| `/grouppanel` | Integrantes y solicitudes | Protegido |
| `/group-settings` | Configuracion del viaje | Protegido |
| `/profile` | Perfil y preferencias de notificacion | Protegido |
| `*` | No encontrado | Publico |

## Variables de entorno

Plantilla: `.env.example`.

| Variable | Uso |
| --- | --- |
| `VITE_API_URL` | Base de la API (`http://localhost:3001/api` en desarrollo, `/api` en produccion). |
| `VITE_SUPABASE_URL` | URL del proyecto de Supabase. |
| `VITE_SUPABASE_ANON_KEY` | Llave publicable de Supabase. |
| `VITE_OAUTH_PROVIDERS` | Proveedores sociales habilitados (por ejemplo `google`). Vacio = solo correo. |

Todas son publicas. Detalle en [../docs/env/README.md](../docs/env/README.md).

## Instalacion y ejecucion

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Servidor local: `http://localhost:5173`. Requiere el backend en `http://localhost:3001`.

## Scripts

| Script | Uso |
| --- | --- |
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` | Type check (`tsc -b`) y build de produccion. |
| `npm run lint` | ESLint. |
| `npm run preview` | Sirve el build localmente. |

## Servicios HTTP

`src/services/apiClient.ts` agrega el token de la sesion y maneja errores. Un archivo por modulo:
`groups.ts`, `budget.ts`, `chat.ts`, `documents.ts`, `context-links.ts`, `notifications.ts` y
`export.ts`. Las descargas (CSV y PDF) usan `downloadFile` en `budget.ts`.

## Estado, auth y tiempo real

| Area | Ubicacion |
| --- | --- |
| Auth global | `src/context/AuthContext.tsx`, `src/context/useAuth.ts` |
| Viaje actual | `src/context/TripContext.tsx`, `src/services/groups.ts` |
| Rutas protegidas | `src/components/auth/ProtectedRoute.tsx` |
| Rutas solo publicas | `src/components/auth/PublicRoute.tsx` |
| Socket.IO | `src/hooks/useSocket.ts` |
| Refresco realtime del viaje | `src/hooks/useGroupRealtimeRefresh.ts` |
| Estado de red | `src/hooks/useNetworkMonitor.ts` |
| Notificaciones | `src/hooks/useNotifications.ts` |

Las claves de almacenamiento del navegador usan el prefijo `traveling_` (sesion, viaje actual,
borrador de registro, redireccion tras login).

Cuando el backend agregue o modifique eventos de Socket.IO, actualizar los hooks relacionados y
probar el flujo en dos sesiones si es colaborativo.

## Convenciones para componentes

- Las paginas completas viven en `src/pages/<Nombre>/<Nombre>Page.tsx`.
- Los componentes reutilizables viven en `src/components`; los genericos en `src/components/ui`.
- Las paginas orquestan datos; los componentes hijos renderizan UI.
- Exportar desde `index.ts` cuando el patron ya exista en esa carpeta.
- Preferir tipos compartidos de `src/types` cuando el dato cruza servicios, paginas o componentes.
- El logotipo es `components/ui/Logo` (temporal, en SVG) hasta que el equipo defina el suyo.

## Build y despliegue

`Dockerfile` construye con Vite (recibe `VITE_*` como build args) y sirve el resultado con nginx.
`nginx.conf` devuelve `index.html` para cualquier ruta de la SPA. Despliegue completo en
[../docs/deploy/README.md](../docs/deploy/README.md).

## CI

`ci-frontend.yml` valida PRs hacia `main` o `develop`: `npm ci`, `npm run lint`, `npx tsc --noEmit`
y `npm run build`. Detalle en [../docs/workflows/README.md](../docs/workflows/README.md).
