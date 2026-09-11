# Gráficas del tablero

- Superficie operativa: comparar mora por barrio y consultar su desglose.
- Lectura: métrica → concentración de los cinco primeros → ranking → selección e impresión.
- Datos: conservar los selectores y totales del padrón. Las barras comparan contra el primer lugar; los porcentajes comparan contra el total de la misma métrica.
- Escritorio: `[título / top] [tres métricas] [concentración / suma] [posición / barrio / valor + barra] [selección] [imprimir / informe]`.
- Móvil: `[título] [tres métricas] [concentración] [suma] [posición / barrio / valor / barra] [selección] [acciones]`.
- Sistema: azul institucional para dinero, teal para abonados y rojo para casos críticos; capital azul e intereses ocre; cada servicio mantiene su color e icono. Cifras tabulares, espacios de 8–16 px, radios de 6–12 px, fondos blancos y bordes suaves.
- Identidad: ranking seleccionable con marca de verificación y suma consolidada. Sin adornos ni dependencias nuevas.
- Riesgos: nombres largos y montos amplios; verificar saltos de línea y barras con igual ancho base en móvil y paneles intermedios.
- QA reproducible: `npm --prefix frontend run dev`, abrir `/tests/dashboard.html?charts=1` y pulsar «Ejecutar comprobación UI». Agregar `&empty=1` para el estado vacío. Datos ficticios aislados del servidor.
- Validación: compilación Vite y pruebas de selectores/impresión correctas; revisión visual a 390×844, 768×1024, 1440×900, 1920×1080 y 2560×1080. Comprobación UI de métricas, concentración, selección persistente, desglose, servicios, limpieza y estado vacío correcta. El punto más exigente sigue siendo la longitud de los nombres: se muestran completos en varias líneas. Verificación local; sin conexión a datos de producción.
