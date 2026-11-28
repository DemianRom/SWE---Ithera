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
- `docs/testing/README.md` muestra `SMOKE_API_URL=http://localhost:3001` sin `/api`, aunque el smoke concatena directamente las rutas y su valor por defecto sí incluye `/api`. Usar la URL completa indicada arriba; corrección documental fuera del alcance de esta entrega.
- `--keep` evita la limpieza final y el borrado del viaje principal, pero el smoke elimina explícitamente el viaje secundario y el gasto porcentual creado durante la prueba. No interpretar la opción como conservación absoluta de todos los datos creados.
- El smoke anuncia limpieza de archivos, pero este informe solo confirmó mediante consulta posterior la ausencia de las cuentas Auth y el viaje principal; no se realizó una auditoría independiente de todos los objetos o filas asociadas.
