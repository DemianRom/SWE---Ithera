# Diagramas - Traveling

Esta carpeta contiene diagramas del sistema. Su objetivo es explicar visualmente flujos, arquitectura, clases, modulos y relaciones relevantes.

## Tipos de diagramas esperados

| Tipo | Ubicacion sugerida | Uso |
| --- | --- | --- |
| Mapa del sistema | `docs/diagramas/` | Vista general de flujos principales. |
| Casos de uso | `docs/diagramas/` | Relacion actor-sistema. |
| Clases | `docs/diagramas/clases/` | Entidades, atributos y relaciones. |
| Secuencia | `docs/diagramas/` | Interacciones entre frontend, backend y servicios externos. |
| Arquitectura | `docs/diagramas/` | Capas y comunicacion entre modulos. |

## Convencion de nombres

```text
system-map.pdf
casos-uso-m1-auth.png
secuencia-login.png
arquitectura-general.png
clases/diagrama-clases-m1-auth.png
clases/diagrama-clases-m2-grupos.png
clases/diagrama-clases-m4-gastos.png
```

## Reglas

- Usar nombres descriptivos y en kebab-case.
- Evitar subir imagenes duplicadas o versiones temporales.
- Si el diagrama reemplaza uno anterior, retirar el obsoleto o marcarlo como historico.
- Si el diagrama documenta una parte implementada, enlazarlo desde el README del modulo correspondiente.

## Artefactos relacionados

Los diagramas de Ithera (por ejemplo `system_map.pdf`) estan en [../legacy-ithera/](../legacy-ithera/README.md) como referencia historica; no describen el alcance de Traveling.
