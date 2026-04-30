export const MAX_LOOKUP_HISTORY_ITEMS = 8;

export const MAP_POINT_TYPES = [
  { value: "caja_registro", label: "Caja de registro" },
  { value: "descarga", label: "Descarga" },
  { value: "pozo", label: "Pozo de visita" },
  { value: "punto_observado", label: "Punto observado" }
];

export const MAP_MARKER_COLORS = [
  { value: "#1576d1", label: "Azul operativo" },
  { value: "#ef4444", label: "Rojo critico" },
  { value: "#f59e0b", label: "Amarillo alerta" },
  { value: "#10b981", label: "Verde validado" },
  { value: "#7c3aed", label: "Morado referencia" }
];

export const emptyMapDraft = {
  latitude: "",
  longitude: "",
  accuracy_meters: "",
  point_type: "caja_registro",
  description: "",
  reference: ""
};

export const emptyMapReportDraft = {
  latitude: "",
  longitude: "",
  accuracy_meters: "",
  point_type: "caja_registro",
  description: "",
  reference: "",
  marker_color: "#1576d1",
  is_terminal_point: false
};

export const defaultMapReportStaff = {
  field_technicians: "LUIS FERNANDO HERRERA SOLIZ",
  field_technician_secondary: "Oscar Ivan Alvarez",
  data_engineer: "Ing. Juan Ordoñez Bonilla"
};

export const defaultPadronRequestForm = {
  preset_id: "apartamentos",
  title: "Reporte general de apartamentos",
  description:
    "Apartamentos y unidades habitacionales identificadas en el padron maestro, agrupadas por barrio para control administrativo.",
  keywords: "apart, apartamento, apartamentos, apto, aptos"
};

export const emptyForm = {
  id: null,
  clave_catastral: "",
  abonado: "",
  nombre_catastral: "",
  inquilino: "",
  barrio_colonia: "",
  identidad: "",
  telefono: "",
  accion_inspeccion: "",
  situacion_inmueble: "Habitado",
  tendencia_inmueble: "",
  uso_suelo: "Residencial",
  actividad: "Vivienda",
  codigo_sector: "",
  comentarios: "Clandestino",
  estado_padron: "clandestino",
  clave_alcaldia: "",
  nombre_alcaldia: "",
  barrio_alcaldia: "",
  conexion_agua: "Si",
  conexion_alcantarillado: "Si",
  recoleccion_desechos: "Si",
  foto_path: "",
  fecha_aviso: new Date().toISOString().slice(0, 10),
  firmante_aviso: "Maria Eugenia Berrios",
  cargo_firmante: "Jefe de Facturacion",
  levantamiento_datos: "LUIS FERNANDO HERRERA SOLIZ",
  analista_datos: "Ing. Juan Ordoñez Bonilla"
};

export const fieldGroups = [
  [
    { key: "abonado", label: "Abonado" },
    { key: "nombre_catastral", label: "Catastral" },
    { key: "inquilino", label: "Inquilino" }
  ],
  [
    { key: "barrio_colonia", label: "Barrio/Colonia/Lotificacion" },
    { key: "identidad", label: "No. de Identidad" },
    { key: "telefono", label: "Telefono/Celular" }
  ],
  [
    { key: "situacion_inmueble", label: "Situacion del inmueble" },
    { key: "tendencia_inmueble", label: "Tendencia del inmueble" },
    { key: "uso_suelo", label: "Uso del suelo" }
  ],
  [
    { key: "actividad", label: "Actividad" },
    { key: "codigo_sector", label: "Codigo del sector" },
    { key: "comentarios", label: "Comentarios" }
  ],
  [
    { key: "conexion_agua", label: "Conexion de agua potable" },
    { key: "conexion_alcantarillado", label: "Conexion alcantarillado" },
    { key: "recoleccion_desechos", label: "Recoleccion de desechos" }
  ]
];

export const recordQuickFilterOptions = [
  { key: "all", label: "Todas" },
  { key: "clandestino", label: "Clandestinas" },
  { key: "reportada", label: "Reportadas" },
  { key: "no_photo", label: "Sin foto" },
  { key: "alert", label: "Alertas" },
  { key: "today", label: "Hoy" },
  { key: "varios_padrones", label: "Varios padrones" }
];

export const recordStatusFilterOptions = [
  { key: "all", label: "Todos los estados" },
  { key: "overdue", label: "Vencidas" },
  { key: "due", label: "Vence hoy" },
  { key: "warning", label: "Por vencer" },
  { key: "on_track", label: "En plazo" },
  { key: "no_photo", label: "Sin foto" }
];

export const sectionDefinitions = [
  { key: "abonado", label: "Abonado", mobileLabel: "Datos" },
  { key: "inmueble", label: "Inmueble", mobileLabel: "Inmueble" },
  { key: "servicios", label: "Servicios", mobileLabel: "Servicios" },
  { key: "aviso", label: "Aviso", mobileLabel: "Aviso" },
  { key: "foto", label: "Foto", mobileLabel: "Foto" }
];

export const saveIntentOptions = {
  stay: "stay",
  new: "new"
};

export const LOOKUP_SEARCH_MODES = [
  {
    value: "clave",
    label: "Clave",
    helper: "Consulta exacta o por base catastral",
    inputMode: "numeric"
  },
  {
    value: "nombre",
    label: "Nombre",
    helper: "Busca por inquilino o nombre asociado",
    inputMode: "text"
  },
  {
    value: "abonado",
    label: "Abonado",
    helper: "Busca por numero de abonado",
    inputMode: "numeric"
  },
  {
    value: "alcaldia",
    label: "Alcaldia",
    helper: "Clave, nombre o barrio del padron municipal",
    inputMode: "text"
  }
];
