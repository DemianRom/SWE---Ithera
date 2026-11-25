# Requerimientos - Traveling

Esta carpeta documenta los requerimientos funcionales, no funcionales y reglas de negocio del sistema.

## Convencion de identificadores

| Prefijo | Significado | Ejemplo |
| --- | --- | --- |
| `RF-X.Y` | Requerimiento funcional del modulo X. | `RF-1.1 Autenticacion de usuarios` |
| `RNF-X.Y` | Requerimiento no funcional del modulo X. | `RNF-1.1 Proteccion de datos` |
| `RNB-X.Y` | Regla de negocio del modulo X. | `RNB-1.1 Validez del token` |
| `CU-X.Y` | Caso de uso del modulo X. | `CU-1.1 Iniciar sesion` |

## Modulos

| ID | Modulo |
| --- | --- |
| M1 | Cuentas y acceso |
| M2 | Viajes, integrantes y permisos |
| M3 | Itinerario basico |
| M4 | Gastos y repartos |
| M5 | Presupuesto (total y por categoria) |
| M6 | Saldos y pagos entre companeros |
| M7 | Comprobantes y resumenes |
| M8 | Notificaciones, chat y tiempo real |

M1 a M3 son la base comun con el Equipo 1; M4 a M7 son el alcance del Equipo 2. Los
requerimientos originales de Ithera (incluida la busqueda de vuelos y hospedajes) estan en
[../legacy-ithera/](../legacy-ithera/README.md) como referencia historica.

## Criterios para mantener requerimientos

- Cada requerimiento debe ser claro, verificable y trazable.
- Si un requerimiento cambia, actualizar tambien los casos de uso relacionados.
- Si un requerimiento ya esta implementado, enlazarlo con endpoint, pantalla o modulo.
- No mezclar notas temporales con requerimientos oficiales.

## Relacion con otros documentos

- Casos de uso: [../casos-de-uso/README.md](../casos-de-uso/README.md)
- API implementada: [../api/endpoints.md](../api/endpoints.md)
- Arquitectura actual: [../architecture/README.md](../architecture/README.md)

Los documentos fuente exportados desde PDFs o herramientas externas deben revisarse antes de considerarse documentacion oficial.
