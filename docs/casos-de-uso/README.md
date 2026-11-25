# Casos de Uso - Traveling

Esta carpeta concentra la documentacion de casos de uso del sistema. Los casos de uso describen como interactuan los actores con Traveling y sirven como puente entre requerimientos, diseno e implementacion.

## Modulos cubiertos

| Modulo | Nombre | Ejemplos de casos |
| --- | --- | --- |
| M1 | Cuentas y acceso | Registro con codigo, login, Google, recuperacion de contrasena, perfil. |
| M2 | Viajes, integrantes y permisos | Crear viaje, invitar, unirse, administrar roles, cerrar viaje. |
| M3 | Itinerario basico | Ver itinerario, crear actividades con horario y ubicacion, compartir enlace publico. |
| M4 | Gastos y repartos | Registrar gasto con quien pago, repartir igual o personalizado, editar o borrar. |
| M5 | Presupuesto | Definir presupuesto total y por categoria, comparar planeado vs. gastado, alertas. |
| M6 | Saldos y pagos | Consultar saldos, registrar un pago, confirmarlo o rechazarlo. |
| M7 | Comprobantes y resumenes | Subir comprobantes, descargar resumen PDF y CSV. |
| M8 | Notificaciones, chat y tiempo real | Chat grupal, notificaciones y preferencias, refresco en vivo. |

## Formato recomendado

Cada caso de uso debe incluir:

- ID: `CU-X.Y`.
- Nombre.
- Actor principal.
- Proposito.
- Precondiciones.
- Flujo principal.
- Flujos alternos.
- Errores o excepciones.
- Postcondiciones.
- Requerimientos relacionados.
- Pantallas o endpoints relacionados si ya existen.

## Convencion de IDs

```text
CU-1.1 Iniciar sesion
CU-1.2 Registrar cuenta
CU-2.1 Crear viaje
CU-2.2 Unirse a un viaje por invitacion
CU-3.1 Consultar itinerario
CU-4.1 Registrar gasto
CU-5.1 Definir presupuesto por categoria
CU-6.1 Registrar pago a un companero
CU-7.1 Descargar resumen del viaje
CU-8.1 Enviar mensaje en chat
```

## Relacion con otros documentos

- Requerimientos: [../requerimientos/README.md](../requerimientos/README.md)
- Endpoints implementados: [../api/endpoints.md](../api/endpoints.md)
- Arquitectura: [../architecture/README.md](../architecture/README.md)

Si un caso de uso ya esta implementado, debe poder rastrearse hacia su ruta frontend, endpoint backend o servicio de dominio.
