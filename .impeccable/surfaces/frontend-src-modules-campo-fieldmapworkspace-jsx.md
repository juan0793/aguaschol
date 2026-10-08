---
version: 1
slug: "frontend-src-modules-campo-fieldmapworkspace-jsx"
primary_target: "frontend/src/modules/campo/FieldMapWorkspace.jsx"
related_targets: ["frontend/src/components/FieldMap.jsx","frontend/src/modules/campo/field-map.css"]
---

# Puntos GPS (mapa de campo)

Modo: Operate. Quién: el técnico de campo en la calle, con el celular en una mano, a pleno sol y a veces sin datos; la oficina revisa la misma pantalla en escritorio.

Tarea: registrar cajas de registro, descargas, pozos, negocios, alertas y puntos observados con ubicación exacta, muchos por jornada (hay días de más de 300 puntos). Flujo confirmado por el usuario (2026-10-08): el técnico usa su ubicación, la app lo lleva ahí con zoom, coloca el punto y lo marca. Solo tipo y ubicación son obligatorios; referencia, descripción y viviendas se completan después. Sin señal: los puntos se guardan en el celular y se envían solos; el mapa de una zona se puede guardar antes de salir. Pronto será PWA.

Restricciones: nada capturado se pierde; los colores de tipo deben distinguirse sobre el mapa claro y no depender solo del color; el reporte impreso sigue usando `marker_color`.

## Direction contract

THESIS: El celular es un visor de agrimensor: el GPS te acerca, el mapa se mueve bajo una mira fija y un botón grande marca el punto exacto sin que el dedo lo tape. Rechaza el mapa encajonado al lado de un formulario largo, que es lo que hoy ve el técnico.

OWN-WORLD: El mundo institucional de DESIGN.md: superficies blancas, tinta `#16283b`, azul `#1465d9`, azul profundo `#0b3f73`, filetes `#dfe5ec`. El mapa va a sangre y es el protagonista. Las lecturas (precisión, coordenadas, envíos) son cifras tabulares en una franja blanca, como un instrumento. La mira es un anillo azul profundo con halo blanco. Los seis tipos tienen color y además un glifo propio; el estado de envío es verde (enviado), ocre (por enviar) y gris (sin señal).

STORY: El técnico abre Puntos GPS, toca "Mi ubicación" y el mapa vuela a su calle a zoom 19, con el círculo de precisión. Mueve el mapa, o toca un lugar, hasta que la mira queda sobre la caja; elige el tipo (se recuerda el último) y pulsa "Marcar". El punto queda guardado en el celular al instante, cae en el mapa y se envía cuando hay señal. Un aviso ofrece "Detalles" y "Deshacer".

FIRST VIEWPORT: Teléfono 390×844. Arriba, una franja de lecturas de 52 px: GPS ±m con su color de calidad, latitud y longitud de la mira, y el estado de envío. En el centro, el mapa a sangre con la mira; a la derecha, botones flotantes "Mi ubicación" (grande), acercar, alejar y "Zonas" (guardar sin señal y leyenda). Abajo, una hoja con los seis tipos en fichas deslizables y "Marcar aquí" de 56 px a todo el ancho; un tirador sube la jornada. En escritorio, el visor ocupa todo y una columna de 400 px a la derecha lleva tipos, Marcar, detalles y la jornada.

FORM: Visor con mira, posición 7 de mi lista ordenada; seed key 80220fe9.

Signature interaction: al soltar el mapa, la mira "fija": el anillo se contrae y las coordenadas se actualizan; al marcar, el punto cae con un pulso corto y el celular vibra.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
