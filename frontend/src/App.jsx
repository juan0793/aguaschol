import { useEffect, useMemo, useState } from "react";
import logoAguasCholuteca from "./assets/logo-aguas-choluteca.png";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
const FILES_URL = (import.meta.env.VITE_FILES_URL ?? "http://localhost:4000").replace(/\/$/, "");

const emptyForm = {
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
  conexion_agua: "Si",
  conexion_alcantarillado: "Si",
  recoleccion_desechos: "Si",
  foto_path: "",
  fecha_aviso: new Date().toISOString().slice(0, 10),
  firmante_aviso: "Maria Eugenia Berrios",
  cargo_firmante: "Jefe de Facturacion",
  levantamiento_datos: "LUIS FERNANDO HERRERA SOLIZ",
  analista_datos: "JUAN ORDONEZ BONILLA"
};

const fieldGroups = [
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

const printDocument = async (title, bodyMarkup) => {
  const printWindow = window.open("", "_blank", "width=980,height=1200");

  if (!printWindow) {
    window.alert("No fue posible abrir la ventana de impresion.");
    return;
  }

  printWindow.document.write(`
    <html lang="es">
      <head>
        <title>${title}</title>
        <style>
          @page {
            size: Letter portrait;
            margin: 10mm;
          }
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            color: #111;
            line-height: 1.2;
            font-size: 11px;
          }
          h1, h2, h3, p { margin: 0 0 6px; }
          .print-header { text-align: center; margin-bottom: 8px; }
          .print-logo {
            width: 62px;
            height: 62px;
            object-fit: contain;
            display: block;
            margin: 0 auto 6px;
          }
          .print-title { text-transform: uppercase; font-weight: 700; font-size: 14px; margin-bottom: 4px; }
          .print-key {
            display: inline-block;
            border: 1px solid #666;
            padding: 4px 10px;
            margin-top: 4px;
            font-weight: 700;
          }
          .print-section {
            border: 1px solid #777;
            padding: 7px;
            margin-bottom: 7px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .print-section h3 {
            font-size: 11px;
            margin-bottom: 5px;
            text-transform: uppercase;
          }
          .print-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
          }
          .print-field {
            border-bottom: 1px solid #bbb;
            padding-bottom: 3px;
            min-height: 24px;
          }
          .print-field strong {
            display: block;
            font-size: 9px;
            text-transform: uppercase;
            margin-bottom: 2px;
          }
          .print-photo {
            margin-top: 8px;
            width: 100%;
            max-height: 190px;
            object-fit: contain;
            object-position: center;
            border: 1px solid #999;
            border-radius: 8px;
            background: #fff;
          }
          .print-roles {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
            margin-top: 28px;
            text-align: center;
          }
          .print-signature-line {
            border-top: 1px solid #444;
            padding-top: 14px;
            min-height: 72px;
          }
          .print-signature-line strong {
            font-size: 10px;
            display: block;
            margin-bottom: 10px;
          }
          .aviso {
            max-width: 720px;
            margin: 0 auto;
            padding: 12px 6px;
          }
          .aviso-header, .aviso-title, .aviso-signature, .aviso-copy {
            text-align: center;
          }
          .aviso-header p, .aviso-title, .aviso-copy {
            margin-bottom: 12px;
          }
          .aviso-date, .aviso-saludo {
            text-align: left;
            margin-bottom: 14px;
          }
          .aviso-body, .aviso-list li {
            text-align: justify;
            line-height: 1.45;
          }
          .aviso-list {
            margin: 6px 0 16px 22px;
          }
          .aviso-signature {
            margin-top: 34px;
          }
          .aviso-signature p {
            margin-bottom: 8px;
          }
          ul { margin-top: 0; }
          @media print {
            body { margin: 0; }
          }
        </style>
      </head>
      <body>${bodyMarkup}</body>
    </html>
      `);
  printWindow.document.close();

  const images = Array.from(printWindow.document.images);
  await Promise.all(
    images.map(
      (image) =>
        new Promise((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }

          image.onload = () => resolve();
          image.onerror = () => resolve();
        })
    )
  );

  printWindow.focus();
  printWindow.print();
};

const formatSpanishDate = (value) => {
  if (!value) return "--";
  return new Intl.DateTimeFormat("es-HN", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
};

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No fue posible leer la imagen seleccionada."));
    reader.readAsDataURL(file);
  });

const urlToDataUrl = async (url) => {
  const response = await fetch(url, { cache: "no-store" });
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No fue posible preparar la imagen para impresion."));
    reader.readAsDataURL(blob);
  });
};

function App() {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("Cargando registros...");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [avisoHtml, setAvisoHtml] = useState("");
  const [loadingAviso, setLoadingAviso] = useState(false);
  const [activeSection, setActiveSection] = useState("abonado");

  const selectedPhotoUrl = useMemo(() => {
    if (!form.foto_path) return "";
    const version = encodeURIComponent(form.updated_at || Date.now());
    return `${FILES_URL}${form.foto_path}?v=${version}`;
  }, [form.foto_path, form.updated_at]);

  const localSelectedPhotoUrl = useMemo(() => {
    if (!selectedFile) return "";
    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (localSelectedPhotoUrl) {
        URL.revokeObjectURL(localSelectedPhotoUrl);
      }
    };
  }, [localSelectedPhotoUrl]);

  const loadRecords = async (query = "") => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/inmuebles?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setRecords(data);
      setMessage(data.length ? "" : "No hay registros para mostrar.");
    } catch (_error) {
      setMessage("No fue posible cargar los registros.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const applyRecord = (record) => {
    setForm({ ...emptyForm, ...record });
    setSelectedFile(null);
    setAvisoHtml("");
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    if (!search.trim()) {
      loadRecords("");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/inmuebles/clave/${encodeURIComponent(search)}`);
      if (!response.ok) {
        setMessage("No se encontro esa clave catastral.");
        setRecords([]);
        return;
      }

      const data = await response.json();
      setRecords([data]);
      applyRecord(data);
      setMessage("");
    } catch (_error) {
      setMessage("No fue posible completar la busqueda.");
    }
  };

  const handleSelectRecord = (record) => {
    applyRecord(record);
    setMessage(`Registro ${record.clave_catastral} cargado.`);
  };

  const resetForm = () => {
    setForm(emptyForm);
    setSelectedFile(null);
    setAvisoHtml("");
    setActiveSection("abonado");
  };

  const saveRecord = async (event) => {
    event.preventDefault();
    setSaving(true);

    const isEdit = Boolean(form.id);
    const url = isEdit ? `${API_URL}/inmuebles/${form.id}` : `${API_URL}/inmuebles`;
    const method = isEdit ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "No se pudo guardar el registro.");
      }

      let updated = data;

      if (selectedFile && data.id) {
        const upload = new FormData();
        upload.append("foto", selectedFile);

        const uploadResponse = await fetch(`${API_URL}/inmuebles/${data.id}/foto`, {
          method: "POST",
          body: upload
        });
        updated = await uploadResponse.json();
        if (!uploadResponse.ok) {
          throw new Error(updated.message || "No se pudo subir la fotografia.");
        }
      }

      applyRecord(updated);
      setMessage(isEdit ? "Registro actualizado." : "Registro creado.");
      loadRecords(search);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const generateAviso = async () => {
    setLoadingAviso(true);
    try {
      const response = form.id
        ? await fetch(`${API_URL}/inmuebles/${form.id}/aviso`)
        : await fetch(`${API_URL}/inmuebles/aviso-preview`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(form)
          });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "No fue posible generar el aviso.");
      }

      setAvisoHtml(data.aviso_html);
      setMessage(form.id ? "Aviso generado." : "Aviso preliminar generado.");
      const avisoWindow = window.open("", "_blank", "width=980,height=1200");
      if (avisoWindow) {
        const initialData = {
          fecha_aviso: data.fecha_aviso || form.fecha_aviso || "",
          barrio_colonia: data.barrio_colonia || form.barrio_colonia || "",
          clave_catastral: data.clave_catastral || form.clave_catastral || "",
          firmante_aviso: data.firmante_aviso || form.firmante_aviso || "",
          cargo_firmante: data.cargo_firmante || form.cargo_firmante || ""
        };

        avisoWindow.document.write(`
          <html lang="es">
            <head>
              <title>Aviso ${data.clave_catastral || form.clave_catastral || ""}</title>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  margin: 0;
                  background: #f5f1e8;
                  color: #1b2f35;
                }
                .page {
                  max-width: 860px;
                  margin: 24px auto;
                  background: #fffdf9;
                  border: 1px solid #d8cfbc;
                  border-radius: 24px;
                  box-shadow: 0 18px 45px rgba(18, 52, 59, 0.12);
                  padding: 36px 46px;
                }
                .workspace {
                  max-width: 1180px;
                  margin: 24px auto;
                  display: grid;
                  grid-template-columns: 320px minmax(0, 1fr);
                  gap: 18px;
                  padding: 0 16px;
                }
                .editor {
                  background: #fffdf9;
                  border: 1px solid #d8cfbc;
                  border-radius: 24px;
                  box-shadow: 0 18px 45px rgba(18, 52, 59, 0.08);
                  padding: 20px;
                  align-self: start;
                  position: sticky;
                  top: 18px;
                }
                .editor h2 {
                  margin: 0 0 14px;
                  font-size: 18px;
                }
                .editor label {
                  display: grid;
                  gap: 6px;
                  margin-bottom: 12px;
                  font-size: 14px;
                  font-weight: 700;
                }
                .editor input, .editor textarea {
                  width: 100%;
                  border: 1px solid #cfc6b6;
                  border-radius: 14px;
                  padding: 10px 12px;
                  font: inherit;
                  font-weight: 400;
                }
                .editor p {
                  font-size: 13px;
                  color: #5f6668;
                  margin-top: 8px;
                }
                .toolbar {
                  max-width: 1180px;
                  margin: 18px auto 0;
                  display: flex;
                  justify-content: flex-end;
                  gap: 10px;
                  padding: 0 16px;
                }
                .toolbar button {
                  border: none;
                  border-radius: 999px;
                  padding: 10px 16px;
                  cursor: pointer;
                  background: #b7652b;
                  color: white;
                  font: inherit;
                }
                .toolbar button.secondary {
                  background: #d7e1e3;
                  color: #12343b;
                }
                .logo-wrap {
                  display: flex;
                  justify-content: center;
                  margin-bottom: 10px;
                }
                .logo-wrap img {
                  width: 110px;
                  height: 110px;
                  object-fit: contain;
                }
                .aviso {
                  max-width: 720px;
                  margin: 0 auto;
                }
                .aviso-header, .aviso-title, .aviso-signature, .aviso-copy {
                  text-align: center;
                }
                .aviso-header p, .aviso-title, .aviso-copy {
                  margin: 0 0 12px;
                }
                .aviso-date, .aviso-saludo {
                  margin: 0 0 16px;
                }
                .aviso-body {
                  text-align: justify;
                  line-height: 1.65;
                  margin: 0 0 16px;
                }
                .aviso-list {
                  margin: 0 0 18px 24px;
                  padding: 0;
                }
                .aviso-list li {
                  margin-bottom: 8px;
                  line-height: 1.55;
                }
                .aviso-signature {
                  margin-top: 34px;
                }
                .aviso-signature p {
                  margin: 0 0 8px;
                }
                @media print {
                  @page {
                    size: A4 portrait;
                    margin: 14mm;
                  }
                  body {
                    background: white;
                  }
                  .toolbar {
                    display: none;
                  }
                  .workspace {
                    display: block;
                    margin: 0;
                    padding: 0;
                  }
                  .editor {
                    display: none;
                  }
                  .page {
                    margin: 0;
                    box-shadow: none;
                    border: none;
                    border-radius: 0;
                    padding: 0;
                    max-width: none;
                  }
                }
              </style>
            </head>
            <body>
              <div class="toolbar">
                <button class="secondary" onclick="window.close()">Cerrar</button>
                <button onclick="window.print()">Imprimir aviso</button>
              </div>
              <div class="workspace">
                <aside class="editor">
                  <h2>Editar Aviso</h2>
                  <label>
                    Fecha del aviso
                    <input id="fecha_aviso" type="date" />
                  </label>
                  <label>
                    Ubicacion del inmueble
                    <input id="barrio_colonia" type="text" />
                  </label>
                  <label>
                    Clave catastral
                    <input id="clave_catastral" type="text" />
                  </label>
                  <label>
                    Firmante
                    <input id="firmante_aviso" type="text" />
                  </label>
                  <label>
                    Cargo
                    <input id="cargo_firmante" type="text" />
                  </label>
                  <p>Los cambios se reflejan inmediatamente en el documento antes de imprimir.</p>
                </aside>
                <main class="page">
                  <div class="logo-wrap">
                    <img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" />
                  </div>
                  <section id="aviso-preview"></section>
                </main>
              </div>
              <script>
                const state = ${JSON.stringify(initialData)};
                const formatSpanishDate = (value) => {
                  if (!value) return "__________";
                  const date = new Date(value + "T00:00:00");
                  return new Intl.DateTimeFormat("es-HN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                  }).format(date);
                };
                const renderAviso = () => {
                  const fecha = formatSpanishDate(state.fecha_aviso);
                  const barrio = state.barrio_colonia || "__________";
                  const clave = state.clave_catastral || "__________";
                  const firmante = state.firmante_aviso || "______________________";
                  const cargo = state.cargo_firmante || "______________________";
                  document.getElementById("aviso-preview").innerHTML = \`
                    <section class="aviso">
                      <div class="aviso-header">
                        <p><strong>AGUAS DE CHOLUTECA</strong></p>
                        <p>Departamento de Comercializacion</p>
                      </div>
                      <h2 class="aviso-title">AVISO IMPORTANTE AL ABONADO</h2>
                      <p class="aviso-date">Fecha: Choluteca, \${fecha}</p>
                      <p class="aviso-saludo">Estimado(a) Señor(a):</p>
                      <p class="aviso-body">
                        Por medio de la presente, se le informa que, como resultado del reciente levantamiento de información realizado por la Unidad Técnica de Catastro, se ha identificado que el inmueble ubicado en \${barrio}, con Clave Catastral \${clave}, no se encuentra registrado en la base de datos de la empresa, pese a contar con servicios activos.
                      </p>
                      <p class="aviso-body">
                        Con el propósito de regularizar su situación, evitar circunstancias legales y establecer un acuerdo acorde al caso, se le solicita presentarse al Departamento de Comercialización de Aguas de Choluteca, en un plazo máximo de siete (7) días calendario a partir de la recepción del presente aviso, debiendo presentar la siguiente documentación:
                      </p>
                      <ul class="aviso-list">
                        <li>Copia de Escritura pública del Inmueble.</li>
                        <li>Copia de Constancia Catastral vigente.</li>
                        <li>Copia de Documento Nacional de Identificación (DNI).</li>
                        <li>Copia de Permiso de Construcción.</li>
                      </ul>
                      <p class="aviso-body">
                        En caso de no presentarse dentro del plazo indicado, la empresa procederá conforme a los lineamientos administrativos establecidos por la ley que implican recargos y multas.
                      </p>
                      <p class="aviso-body">Sin otro particular, agradecemos su pronta colaboración.</p>
                      <p class="aviso-body">Atentamente,</p>
                      <div class="aviso-signature">
                        <p><strong>\${firmante}</strong></p>
                        <p>\${cargo}</p>
                        <p>Aguas de Choluteca</p>
                      </div>
                      <p class="aviso-copy">C.c. Archivo</p>
                    </section>
                  \`;
                };
                const bindField = (id) => {
                  const input = document.getElementById(id);
                  input.value = state[id] || "";
                  input.addEventListener("input", (event) => {
                    state[id] = event.target.value;
                    renderAviso();
                  });
                };
                ["fecha_aviso", "barrio_colonia", "clave_catastral", "firmante_aviso", "cargo_firmante"].forEach(bindField);
                renderAviso();
              </script>
            </body>
          </html>
        `);
        avisoWindow.document.close();
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoadingAviso(false);
    }
  };

  const handlePrintFicha = async () => {
    let photoMarkup = "";

    try {
      if (selectedFile) {
        const dataUrl = await fileToDataUrl(selectedFile);
        photoMarkup = `<img src="${dataUrl}" alt="Fotografia del inmueble" class="print-photo" />`;
      } else if (selectedPhotoUrl) {
        const dataUrl = await urlToDataUrl(selectedPhotoUrl);
        photoMarkup = `<img src="${dataUrl}" alt="Fotografia del inmueble" class="print-photo" />`;
      }
    } catch (_error) {
      setMessage("La ficha se imprimira sin foto porque no fue posible cargarla a tiempo.");
    }

    await printDocument(
      `Ficha ${form.clave_catastral || "inmueble"}`,
      `
        <div class="print-header">
          <img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" />
          <p>Aguas de Choluteca, S.A. de C.V.</p>
          <p>Barrio El Centro Antiguo Local de Cooperativa Guadalupe.</p>
          <p>Tel: 2782-5075 Fax: 2780-3985</p>
          <h2 class="print-title">Ficha Tecnica de Informacion Catastral</h2>
          <div class="print-key">CLAVE CATASTRAL: ${form.clave_catastral || "--"}</div>
        </div>
        <section class="print-section">
          <h3>Informacion del abonado</h3>
          <div class="print-grid">
            <div class="print-field"><strong>Abonado</strong>${form.abonado || "--"}</div>
            <div class="print-field"><strong>Catastral</strong>${form.nombre_catastral || "--"}</div>
            <div class="print-field"><strong>Inquilino</strong>${form.inquilino || "--"}</div>
            <div class="print-field"><strong>Barrio/Colonia</strong>${form.barrio_colonia || "--"}</div>
            <div class="print-field"><strong>Identidad</strong>${form.identidad || "--"}</div>
            <div class="print-field"><strong>Telefono</strong>${form.telefono || "--"}</div>
          </div>
        </section>
        <section class="print-section">
          <h3>Identificacion del inmueble</h3>
          <p>${form.accion_inspeccion || "--"}</p>
        </section>
        <section class="print-section">
          <h3>Datos del inmueble</h3>
          <div class="print-grid">
            <div class="print-field"><strong>Situacion</strong>${form.situacion_inmueble || "--"}</div>
            <div class="print-field"><strong>Tendencia</strong>${form.tendencia_inmueble || "--"}</div>
            <div class="print-field"><strong>Uso del suelo</strong>${form.uso_suelo || "--"}</div>
            <div class="print-field"><strong>Actividad</strong>${form.actividad || "--"}</div>
            <div class="print-field"><strong>Codigo del sector</strong>${form.codigo_sector || "--"}</div>
            <div class="print-field"><strong>Comentarios</strong>${form.comentarios || "--"}</div>
          </div>
        </section>
        <section class="print-section">
          <h3>Datos de los servicios</h3>
          <div class="print-grid">
            <div class="print-field"><strong>Agua potable</strong>${form.conexion_agua || "--"}</div>
            <div class="print-field"><strong>Alcantarillado</strong>${form.conexion_alcantarillado || "--"}</div>
            <div class="print-field"><strong>Desechos</strong>${form.recoleccion_desechos || "--"}</div>
          </div>
          ${photoMarkup}
        </section>
        <section class="print-section">
          <div class="print-roles">
            <div class="print-signature-line">
              <strong>${form.levantamiento_datos || "--"}</strong><br />
              LEVANTAMIENTO DE DATOS
            </div>
            <div class="print-signature-line">
              <strong>${form.analista_datos || "--"}</strong><br />
              ANALISTA DE DATOS
            </div>
          </div>
        </section>
      `
    );
  };

  const handlePrintAviso = async () => {
    if (!avisoHtml) {
      setMessage("Genera el aviso antes de imprimir.");
      return;
    }

    await printDocument(
      `Aviso ${form.clave_catastral || "inmueble"}`,
      `<div class="print-header"><img src="${logoAguasCholuteca}" alt="Logo Aguas de Choluteca" class="print-logo" /></div>${avisoHtml}`
    );
  };

  return (
    <div className="page-shell">
      <header className="hero no-print">
        <div className="hero-brand">
          <img src={logoAguasCholuteca} alt="Logo Aguas de Choluteca" className="hero-logo" />
          <div>
            <p className="eyebrow">Aguas de Choluteca</p>
            <h1>Registro de inmuebles clandestinos</h1>
            <p className="lead">
              Primera version basada en la ficha tecnica y el formato de aviso del flujo actual.
            </p>
          </div>
        </div>

        <form className="search-card" onSubmit={handleSearch}>
          <label htmlFor="search">Busqueda por clave catastral</label>
          <div className="search-row">
            <input
              id="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ej. 10-22-23"
            />
            <button type="submit">Buscar</button>
          </div>
          <button type="button" className="button-secondary" onClick={() => loadRecords(search)}>
            Refrescar listado
          </button>
        </form>
      </header>

      <main className="layout">
        <aside className="sidebar no-print">
          <div className="panel-header">
            <h2>Registros</h2>
            <button type="button" className="button-secondary" onClick={resetForm}>
              Nuevo
            </button>
          </div>

          {loading ? <p className="helper-text">Cargando...</p> : null}
          {message ? <p className="helper-text">{message}</p> : null}

          <div className="record-list">
            {records.map((record) => (
              <button
                type="button"
                key={record.id ?? record.clave_catastral}
                className={`record-card ${form.id === record.id ? "active" : ""}`}
                onClick={() => handleSelectRecord(record)}
              >
                <strong>{record.clave_catastral}</strong>
                <span>{record.barrio_colonia || "Sin ubicacion"}</span>
                <small>{record.comentarios || "Sin comentario"}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="content">
          <form className="sheet no-print" onSubmit={saveRecord}>
            <div className="sheet-topbar">
              <div className="sheet-brand">
                <img src={logoAguasCholuteca} alt="Logo Aguas de Choluteca" className="brand-logo" />
                <div>
                  <p className="sheet-kicker">Aguas de Choluteca, S.A. de C.V.</p>
                  <p>Barrio El Centro Antiguo Local de Cooperativa Guadalupe.</p>
                  <p>Tel: 2782-5075 Fax: 2780-3985</p>
                </div>
              </div>

              <div className="clave-box">
                <label>Clave Catastral</label>
                <input
                  name="clave_catastral"
                  value={form.clave_catastral}
                  onChange={handleChange}
                  placeholder="00-00-00"
                  required
                />
              </div>
            </div>

            <div className="sheet-title">FICHA TECNICA DE INFORMACION CATASTRAL</div>

            <div className="section-tabs">
              <button type="button" className={activeSection === "abonado" ? "tab active" : "tab"} onClick={() => setActiveSection("abonado")}>
                Abonado
              </button>
              <button type="button" className={activeSection === "inmueble" ? "tab active" : "tab"} onClick={() => setActiveSection("inmueble")}>
                Inmueble
              </button>
              <button type="button" className={activeSection === "servicios" ? "tab active" : "tab"} onClick={() => setActiveSection("servicios")}>
                Servicios
              </button>
              <button type="button" className={activeSection === "aviso" ? "tab active" : "tab"} onClick={() => setActiveSection("aviso")}>
                Aviso y Foto
              </button>
            </div>

            {activeSection === "abonado" ? (
              <section className="sheet-section">
                <h3>Informacion del abonado</h3>
                {fieldGroups.slice(0, 2).map((group, index) => (
                  <div className="form-grid" key={index}>
                    {group.map((field) => (
                      <label key={field.key}>
                        <span>{field.label}</span>
                        <input name={field.key} value={form[field.key]} onChange={handleChange} />
                      </label>
                    ))}
                  </div>
                ))}
              </section>
            ) : null}

            {activeSection === "inmueble" ? (
              <>
                <section className="sheet-section">
                  <h3>Identificacion del inmueble</h3>
                  <label>
                    <span>Accion</span>
                    <textarea
                      name="accion_inspeccion"
                      value={form.accion_inspeccion}
                      onChange={handleChange}
                      rows="4"
                    />
                  </label>
                </section>

                <section className="sheet-section">
                  <h3>Datos del inmueble</h3>
                  {fieldGroups.slice(2, 4).map((group, index) => (
                    <div className="form-grid" key={index}>
                      {group.map((field) => (
                        <label key={field.key}>
                          <span>{field.label}</span>
                          <input name={field.key} value={form[field.key]} onChange={handleChange} />
                        </label>
                      ))}
                    </div>
                  ))}
                </section>
              </>
            ) : null}

            {activeSection === "servicios" ? (
              <section className="sheet-section">
                <h3>Datos de los servicios</h3>
                <div className="form-grid">
                  {fieldGroups[4].map((field) => (
                    <label key={field.key}>
                      <span>{field.label}</span>
                      <select name={field.key} value={form[field.key]} onChange={handleChange}>
                        <option value="Si">Si</option>
                        <option value="No">No</option>
                      </select>
                    </label>
                  ))}
                </div>
              </section>
            ) : null}

            {activeSection === "aviso" ? (
              <section className="sheet-section two-columns compact-columns">
                <div>
                  <h3>Fotografia del inmueble</h3>
                  <label className="file-input">
                    <span>Seleccionar foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                    />
                  </label>
                  {selectedFile ? <p className="helper-text">Archivo listo: {selectedFile.name}</p> : null}
                  {localSelectedPhotoUrl || selectedPhotoUrl ? (
                    <img
                      src={localSelectedPhotoUrl || selectedPhotoUrl}
                      alt="Fotografia del inmueble"
                      className="photo-preview"
                    />
                  ) : (
                    <div className="photo-placeholder">Sin fotografia cargada</div>
                  )}
                </div>

                <div>
                  <h3>Datos para aviso</h3>
                  <div className="stack-fields">
                    <label>
                      <span>Fecha del aviso</span>
                      <input type="date" name="fecha_aviso" value={form.fecha_aviso || ""} onChange={handleChange} />
                    </label>
                    <label>
                      <span>Firmante</span>
                      <input name="firmante_aviso" value={form.firmante_aviso} onChange={handleChange} />
                    </label>
                    <label>
                      <span>Cargo</span>
                      <input name="cargo_firmante" value={form.cargo_firmante} onChange={handleChange} />
                    </label>
                    <label>
                      <span>Levantamiento de datos</span>
                      <input name="levantamiento_datos" value={form.levantamiento_datos} onChange={handleChange} />
                    </label>
                    <label>
                      <span>Analista de datos</span>
                      <input name="analista_datos" value={form.analista_datos} onChange={handleChange} />
                    </label>
                  </div>
                </div>
              </section>
            ) : null}

            <div className="action-row">
              <button type="submit" disabled={saving}>
                {saving ? "Guardando..." : form.id ? "Actualizar ficha" : "Guardar ficha"}
              </button>
              <button type="button" className="button-secondary" onClick={resetForm}>
                Limpiar
              </button>
            </div>
          </form>

          <section className="preview-panel">
            <div className="preview-actions no-print">
              <button type="button" className="button-secondary" onClick={handlePrintFicha}>
                Imprimir ficha
              </button>
              <button type="button" onClick={generateAviso} disabled={loadingAviso}>
                {loadingAviso ? "Generando aviso..." : "Generar aviso"}
              </button>
              <button type="button" className="button-secondary" onClick={handlePrintAviso}>
                Imprimir aviso
              </button>
            </div>

            <h2>Ficha visual</h2>
            <article className="document-sheet">
              <header className="document-header">
                <img src={logoAguasCholuteca} alt="Logo Aguas de Choluteca" className="document-logo" />
                <p>Aguas de Choluteca, S.A. de C.V.</p>
                <p>Barrio El Centro Antiguo Local de Cooperativa Guadalupe.</p>
                <p>Tel: 2782-5075 Fax: 2780-3985</p>
                <h3>FICHA TECNICA DE INFORMACION CATASTRAL</h3>
                <div className="document-key">Clave Catastral: {form.clave_catastral || "--"}</div>
              </header>

              <section className="document-block">
                <h4>Informacion del abonado</h4>
                <div className="document-grid">
                  <div><strong>Abonado</strong><span>{form.abonado || "--"}</span></div>
                  <div><strong>Catastral</strong><span>{form.nombre_catastral || "--"}</span></div>
                  <div><strong>Inquilino</strong><span>{form.inquilino || "--"}</span></div>
                  <div><strong>Barrio/Colonia</strong><span>{form.barrio_colonia || "--"}</span></div>
                  <div><strong>Identidad</strong><span>{form.identidad || "--"}</span></div>
                  <div><strong>Telefono</strong><span>{form.telefono || "--"}</span></div>
                </div>
              </section>

              <section className="document-block">
                <h4>Identificacion del inmueble</h4>
                <p>{form.accion_inspeccion || "Sin detalle de inspeccion."}</p>
              </section>

              <section className="document-block">
                <h4>Datos del inmueble</h4>
                <div className="document-grid">
                  <div><strong>Situacion</strong><span>{form.situacion_inmueble || "--"}</span></div>
                  <div><strong>Tendencia</strong><span>{form.tendencia_inmueble || "--"}</span></div>
                  <div><strong>Uso del suelo</strong><span>{form.uso_suelo || "--"}</span></div>
                  <div><strong>Actividad</strong><span>{form.actividad || "--"}</span></div>
                  <div><strong>Codigo del sector</strong><span>{form.codigo_sector || "--"}</span></div>
                  <div><strong>Comentarios</strong><span>{form.comentarios || "--"}</span></div>
                </div>
              </section>

              <section className="document-block">
                <h4>Datos de los servicios</h4>
                <div className="document-grid">
                  <div><strong>Agua potable</strong><span>{form.conexion_agua || "--"}</span></div>
                  <div><strong>Alcantarillado</strong><span>{form.conexion_alcantarillado || "--"}</span></div>
                  <div><strong>Desechos</strong><span>{form.recoleccion_desechos || "--"}</span></div>
                </div>
                {localSelectedPhotoUrl || selectedPhotoUrl ? (
                  <div className="document-photo-wrap">
                    <img
                      src={localSelectedPhotoUrl || selectedPhotoUrl}
                      alt="Fotografia del inmueble"
                      className="document-photo"
                    />
                  </div>
                ) : null}
              </section>

              <section className="document-block">
                <div className="document-signatures">
                  <div>
                    <strong>{form.levantamiento_datos || "--"}</strong>
                    <span>LEVANTAMIENTO DE DATOS</span>
                  </div>
                  <div>
                    <strong>{form.analista_datos || "--"}</strong>
                    <span>ANALISTA DE DATOS</span>
                  </div>
                </div>
              </section>
            </article>

            <h2>Aviso</h2>
            <article className="aviso-preview-card">
              <div className="aviso-logo-wrap">
                <img src={logoAguasCholuteca} alt="Logo Aguas de Choluteca" className="aviso-logo" />
              </div>
              <h3>AVISO IMPORTANTE AL ABONADO</h3>
              <p className="aviso-preview-date">Fecha: Choluteca, {formatSpanishDate(form.fecha_aviso)}</p>
              <p className="aviso-preview-body">
                El aviso ya no se incrusta en esta pantalla. Usa <strong>Generar aviso</strong> para abrirlo en una
                pestaña aparte con formato de documento e impresión propia.
              </p>
              {avisoHtml ? (
                <p className="helper-text">Ya se generó un aviso para esta ficha en una pestaña independiente.</p>
              ) : (
                <p className="helper-text">
                  Puedes generar un aviso preliminar con los datos actuales o guardar la ficha para usar el registro final.
                </p>
              )}
            </article>
          </section>
        </section>
      </main>
    </div>
  );
}

export default App;
