# Seguridad - Traveling

Esta guia resume reglas de seguridad para desarrollo, revision y despliegue.

## Secretos

- No subir `.env` ni `supabase/.env`.
- No subir tokens, llaves ni credenciales.
- No exponer `SUPABASE_SECRET_KEY` en el frontend; las variables `VITE_*` son publicas.
- Los secretos de deploy viven en GitHub Actions y en el servidor. La llave de deploy solo puede
  ejecutar `deploy.sh` (`command=` y `restrict` en `authorized_keys`).

## Base de datos

- Todas las tablas tienen RLS activo y sin politicas: `anon` y `authenticated` no pueden leer ni
  escribir directamente.
- Solo `service_role` (el backend, con la llave secreta) tiene privilegios. Ver
  [../database/README.md](../database/README.md).
- El navegador solo usa Supabase para Auth (registro, login, OTP y Google).

## Autenticacion

- El backend valida tokens de Supabase con `requireAuth`.
- Los endpoints protegidos deben declarar `requireAuth`.
- Socket.IO valida el token en el handshake antes de registrar handlers.
- El backend mapea el usuario de Supabase al usuario local antes de operar datos internos.
- Contrasenas de al menos 8 caracteres con mayusculas, minusculas y digitos; confirmacion por
  codigo OTP de 6 digitos.

## Autorizacion

Antes de modificar datos de un viaje se valida:

- Que el usuario pertenece al viaje.
- Que tiene el rol necesario cuando el flujo lo requiere (admin).
- Que el recurso pertenece al viaje indicado.
- Que el viaje no esta cerrado (`409`) y que el presupuesto no esta bloqueado (`423`).

Casos sensibles:

- Cambiar roles, delegar admin o eliminar integrantes.
- Aprobar o rechazar solicitudes de union.
- Editar presupuesto total o por categoria.
- Editar o borrar gastos (solo quien lo registro o un admin).
- Confirmar o rechazar pagos (solo quien los recibe).
- Subir o eliminar comprobantes.
- Borrar la cuenta (bloqueado con `409` si tiene gastos compartidos en viajes activos).

## Archivos

- Bucket `trip-documents` privado: el backend entrega URLs firmadas de 1 hora.
- Tipos permitidos: PDF, texto, JPEG, PNG y WebP; maximo 10 MB.
- Cada archivo queda asociado a usuario y viaje; el borrado valida ambos.
- El enlace publico del itinerario esta firmado con `SHARE_LINK_SECRET` y no expone gastos.

## Llave de Google Maps

`VITE_GOOGLE_MAPS_API_KEY` es publica por diseno (queda en el bundle). Debe estar restringida en
Google Cloud a sitios web (`https://traveling.tonyquezada.com/*` y `http://localhost:5173/*`) y a
las APIs Maps JavaScript API y Places API (New). Ver [../maps/README.md](../maps/README.md).

## CORS

El backend permite `FRONTEND_URL` y `http://localhost:5173`. Si se agrega otro dominio, actualizar
`backend/src/index.ts`, `socket.server.ts` y esta guia.

## Rate limit

`backend/src/middlewares/rateLimit.middleware.ts` existe pero no esta montado. Si se activa:
documentar endpoints afectados, definir limites por usuario o IP y probar respuestas `429`.
Supabase Auth limita por su cuenta los correos enviados (`email_sent` en `supabase/config.toml`).

## Checklist de revision

- [ ] No hay secretos en codigo ni docs.
- [ ] Los endpoints sensibles usan `requireAuth`.
- [ ] Se valida pertenencia al viaje y rol cuando aplica.
- [ ] Se respeta viaje cerrado y presupuesto bloqueado.
- [ ] Los archivos subidos tienen limites y no quedan publicos.
- [ ] Las migraciones nuevas no otorgan privilegios a `anon` ni `authenticated`.
- [ ] Los errores no exponen informacion sensible.
