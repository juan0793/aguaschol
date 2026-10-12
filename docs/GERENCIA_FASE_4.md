# Gerencia General — navegación y dashboard

Gerencia inicia en `/dashboard`. Su menú ofrece Inspecciones, Entregas, Clandestinos, búsqueda de claves, SIG Territorial, consulta GPS, Planos autorizados y actividad del equipo. Los enlaces a Usuarios, Railway, importación, configuración, auditoría administrativa y mensajes se redirigen al dashboard; el backend mantiene los permisos de Fase 3.

El dashboard reutiliza `DashboardWorkspace` y `GraficoPorDia`. Consulta servicios existentes para mostrar el corte actual de cartera, barrios con mora, fichas y jornadas GPS; el mes seleccionado filtra inspecciones creadas/finalizadas y Entregas. La carga pendiente por técnico se etiqueta como actual y de todos los períodos. No se construye una serie histórica de mora a partir de un único padrón.

La actualización es manual y cada 60 segundos mientras la página está visible. Cambiar de mes cancela consultas anteriores. Una falla conserva la consulta anterior con aviso y período explícito; sin datos válidos no se presentan ceros sustitutos. Los totales vienen del backend, no de contar filas de una página.

Las pantallas compartidas deshabilitan edición GPS y de inspecciones, avisos y controles de impresión pendientes de Fase 5. Planos muestra mapas autorizados/historial, sin abrir el editor ni pedir asignaciones privadas. Actividad del equipo no marca eventos como vistos ni conecta el canal de mensajes. Los otros roles conservan sus controles.

## Verificación local

- `npm --prefix frontend run test:dashboard`: calendario, totales, datos ausentes, navegación permitida y selectores existentes.
- `npm --prefix frontend run build` y lint de los archivos modificados.
- `frontend/qa-gerencia.html`, mediante Vite, usa datos sintéticos identificados y sustituye todas las peticiones del frontend. No es una fuente de datos para producción ni un simulador de roles. Permite probar errores de lectura y su recuperación.

La integración con una cuenta Gerente General y MySQL aislado sigue pendiente. No se modificó la base de datos ni se ejecutó despliegue. Los informes PDF y la auditoría de exportación corresponden a Fase 5; las sesiones de prueba de roles a Fase 6.
