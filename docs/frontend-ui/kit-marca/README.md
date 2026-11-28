# Kit de marca de Traveling

Referencia visual del Equipo 2 para la renovación del frontend. Incorporada el
25 de noviembre de 2026 desde el kit local trabajado con el equipo. Esta carpeta
será la copia de referencia dentro del repositorio.

- [Abrir el kit](index.html).
- [Tokens CSS](tokens.css): colores, fuentes, espaciado y radios propuestos.
- [Logo horizontal](assets/logo-horizontal.png) y [vertical](assets/logo-vertical.png).
- [Plan de renovación por fases](../FASES_REDISENO_FRONTEND.txt).

## Visualización

Abrir `index.html` en el navegador. También se puede ejecutar desde la raíz del
repositorio:

```sh
python -m http.server 8766 --bind 127.0.0.1 --directory docs/frontend-ui/kit-marca
```

Después abrir `http://127.0.0.1:8766/`. No requiere npm ni backend. Las fuentes
Fredoka y Nunito se cargan desde Google Fonts; sin conexión se usan las alternativas
declaradas en CSS.

## Qué contiene

Identidad, logos PNG originales, paleta, tipografía, botones, estados, patrones de
formulario, ejemplos financieros y criterios de usabilidad. `interacciones.js`
simula únicamente las respuestas de los botones de demostración. No guarda datos,
no hace pagos y no se conecta a la aplicación.

## Uso en el frontend

Trasladar los tokens a la configuración de estilos y los patrones a componentes
React reutilizables. No importar globalmente `style.css`: contiene la composición
del manual, no estilos listos para todas las pantallas de la aplicación.

Conservar contratos de API, permisos y reglas financieras. El mockup ilustra una
dirección visual; no prescribe cambiar rutas ni agregar funciones. Completar los
estados reales y probar accesibilidad conforme al plan antes de cerrar cada fase.

Los logotipos son recursos ráster de la identidad existente. Verificar su lectura
en pequeño y preparar una versión vectorial si se necesita; no sustituir el
lettering por texto de otra fuente.

Esta incorporación es documental: no integra aún el kit al frontend ni publica
cambios. Seguir las reglas de contribución del repositorio para commits y PRs.
