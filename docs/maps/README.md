# Google Places y mapa del itinerario - Traveling

El estudio COCOMO del proyecto cuenta **Google Places** como Archivo de Interfaz Externa
("Informacion de lugares") y la **busqueda y consulta de lugares** como Consulta Externa: al
ubicar una actividad del itinerario, la app consulta lugares por nombre o direccion y recupera
su nombre, direccion y coordenadas, sin modificar el catalogo de Google.

## Que hace la app

| Donde | Que pasa | Codigo |
| --- | --- | --- |
| Formulario de actividad, campo "Ubicacion" | Sugerencias de Google Places mientras se escribe (sesgadas hacia el destino del viaje). Al elegir una, se guarda su nombre como texto visible y su Place ID. Escribir encima suelta el lugar; "Quitar del mapa" lo suelta conservando el texto. | `components/ui/PlaceAutocompleteInput` |
| Pestana Itinerario, encabezado | Mapa con las actividades que tienen lugar: pines numerados en el orden del dia seleccionado o, en la vista general, con el numero de dia. Al tocar un pin se ve la actividad y un enlace a Google Maps. Sin actividades ubicadas, el mapa se centra en el destino. | `components/ui/TripMap`, `HeroCard` en `pages/Itinerary/DashboardPage.tsx` |
| Tarjeta de actividad | "Abrir en Google Maps" lleva al lugar exacto si hay Place ID, o busca el texto si no. | `components/ui/DayView` |

Sin `VITE_GOOGLE_MAPS_API_KEY`, o si Google rechaza la llave, todo vuelve al comportamiento sin
Google: ubicacion en texto libre y foto de portada en el encabezado.

## Datos

- `actividades.place_id` guarda el Place ID (el unico dato de Google que sus terminos permiten
  conservar sin limite). `ubicacion` sigue siendo el texto visible.
- Las coordenadas **no se guardan**: el mapa las pide por Place ID al dibujarse y las conserva en
  memoria durante la sesion. El centro del destino se guarda en `sessionStorage`.
- El backend no llama a Google; solo valida el formato del Place ID.

## APIs y costo

| API de Google | Uso |
| --- | --- |
| Maps JavaScript API | Cargar la libreria y dibujar el mapa. |
| Places API (New) | Sugerencias (Autocomplete), datos del lugar elegido (Place Details) y ubicar el destino (Text Search). |

Para bajar el costo, las sugerencias se piden con un retraso de 300 ms, desde 3 caracteres y
dentro de una sesion que termina al elegir un lugar; las coordenadas y el destino se piden una
vez por sesion del navegador. Google exige cuenta de facturacion; el uso de un proyecto escolar
normalmente queda dentro de su cuota gratuita mensual. Conviene fijar topes de cuota diarios.

## Configurar la llave

1. En [Google Cloud Console](https://console.cloud.google.com/), crear o elegir un proyecto y
   ligarle una cuenta de facturacion.
2. Habilitar **Maps JavaScript API** y **Places API (New)** (APIs y servicios -> Biblioteca).
3. Crear una llave (APIs y servicios -> Credenciales -> Crear credenciales -> Clave de API) y
   restringirla:
   - Restriccion de aplicacion: **Sitios web**, con `https://traveling.tonyquezada.com/*` y
     `http://localhost:5173/*`.
   - Restriccion de API: solo **Maps JavaScript API** y **Places API (New)**.
4. Opcional: en Google Maps Platform -> Administracion de mapas, crear un **Map ID** de tipo
   JavaScript (vectorial). Sin el, la app usa `DEMO_MAP_ID`.
5. Poner los valores en `.env` (raiz, para Docker Compose) o en `frontend/.env` (desarrollo):

   ```text
   VITE_GOOGLE_MAPS_API_KEY=AIza...
   VITE_GOOGLE_MAPS_MAP_ID=...
   ```

6. En produccion, reconstruir el frontend: `./deploy.sh --force` (las variables `VITE_*` se
   incrustan al compilar).

La llave queda visible en el bundle; la proteccion son las restricciones del paso 3.

## Atribucion

La lista de sugerencias muestra "Google Maps" al pie, como piden las politicas de Places cuando
los resultados aparecen fuera de un mapa de Google.
