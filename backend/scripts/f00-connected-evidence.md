# Evidencia F00 conectado — 27 de noviembre de 2026

- Worktree `feature/traveling-f00-connected`, base `8b41100`; API del manager en el mismo commit y árbol limpio al inicio. El servidor existente no se modificó ni reinició.
- API `http://127.0.0.1:3001/api`; `/health` devolvió 200. El entorno efectivo del proceso Node apunta a Supabase `http://127.0.0.1:55321`. El contenedor local PostgreSQL publica el puerto 55322. Las siete versiones de `supabase_migrations.schema_migrations` coinciden con los siete archivos de `supabase/migrations` (última: `20261126190509`). No se aplicaron migraciones ni se reinició la base.
- Se instalaron dependencias con `npm ci --no-audit --no-fund` en el worktree aislado. Se ejecutó `node --env-file=<backend/.env del manager> scripts/smoke.mjs` con `SMOKE_API_URL=http://127.0.0.1:3001/api`. Los valores sensibles no se registraron. Ejecución `mwzz7u8i15e8`: salida 50/50 pasos sin error inesperado, código 0. Tres cuentas de prueba nuevas; limpieza informada como correcta. Consulta posterior de solo lectura: cero cuentas Auth con ese identificador y cero viajes con nombre `Smoke mwzz7u8i15e8`.

## Cobertura observada

- Gastos: creación equitativa y personalizada; tablero 1200 y resumen 1600, categorías, presupuesto excedido y restricción en viaje cerrado. El smoke no comprueba individualmente los importes del reparto equitativo ni personalizado.
- Porcentual: rechazo HTTP 400 para suma incompleta, sin gasto adicional; 33.33/33.33/33.34 y porcentajes almacenados verificados.
- Saldos y liquidaciones: ambos endpoints responden, y el resumen verifica que la suma de saldos sea aproximadamente cero; no se cotejan los saldos individuales ni las propuestas de liquidación contra importes esperados.
- Pagos: registro con comprobante, estado pendiente y confirmación por acreedor; se observa la notificación. No se verifica el efecto numérico sobre saldos, el rechazo, corrección, pago parcial ni doble confirmación.
- Exportación: CSV con BOM, cabecera y gasto esperado; PDF de resumen con firma `%PDF-`, recibo con tipo PDF. No se comprueba exhaustivamente el contenido ni el formato visual de los archivos.
- Archivos: subida y listado, URL firmada accesible y URL pública denegada. Itinerario, vínculos, permisos, notificaciones, chat y enlace compartido cubiertos según las aserciones del smoke. No se validó la interfaz de escritorio conectada.

## Hallazgos y pendientes

- No se observó un fallo de producto en los pasos ejecutados; el resultado no demuestra los escenarios no comprobados arriba ni cierra F00 visual.
- Se detectó que `docs/testing/README.md` omitía `/api` en `SMOKE_API_URL`; la guía se corrigió posteriormente para usar la URL completa indicada arriba.
- `--keep` evita la limpieza final y el borrado del viaje principal, pero el smoke elimina explícitamente el viaje secundario y el gasto porcentual creado durante la prueba. No interpretar la opción como conservación absoluta de todos los datos creados.
- El smoke anuncia limpieza de archivos, pero este informe solo confirmó mediante consulta posterior la ausencia de las cuentas Auth y el viaje principal; no se realizó una auditoría independiente de todos los objetos o filas asociadas.

## Ampliación: pagos y saldos — 27 de noviembre de 2026

- Antes de ejecutar se volvió a comprobar la API en `127.0.0.1:3001`, su entorno efectivo de Supabase en `127.0.0.1:55321`, salud HTTP 200 y las siete migraciones locales. El servidor pertenecía al manager, HEAD `3f1f53b`, sin cambios locales; los archivos de dominio y rutas de presupuesto coincidían con `8b41100`. No se modificó ni reinició el servidor ni la base.
- Ejecución `mwzzb2jsee9a` con el mismo comando y configuración local descritos arriba: **52/52 pasos**, código 0. `node --check backend/scripts/smoke.mjs` y `git diff --check` correctos. La limpieza del smoke informó éxito; consulta posterior: cero cuentas Auth y cero viajes principal o secundario correspondientes a esta ejecución. No se auditó de forma independiente todo el almacenamiento.
- Con dos gastos de 900 y 300, saldos iniciales comprobados por integrante: acreedor 500, segundo integrante -50 y deudor -450. El pago de 300 pendiente no modifica esos valores; confirmado por el acreedor, los saldos consultados quedan 200, -50 y -150. Una segunda confirmación responde 400 y no modifica los saldos.
- Un pago parcial adicional de 100 se registra pendiente. El deudor recibe 403 al intentar rechazarlo; el acreedor recibe 400 sin motivo. El rechazo con motivo conserva estado y motivo, y los saldos 200, -50 y -150. Estos resultados amplían la sección anterior, que describe únicamente la primera ejecución.
- Límite: no se comprobó edición/corrección de pago, confirmación de otro pago parcial, concurrencia de revisiones ni la interfaz de escritorio conectada. La conservación del identificador del viaje al crearlo mejora la limpieza en salidas tempranas; otros fallos de infraestructura podrían igualmente requerir limpieza manual de los datos de prueba.
