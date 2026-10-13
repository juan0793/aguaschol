import React from "react";
import ReactDOM from "react-dom/client";
import NotesPage from "../modules/notes/pages/NotesPage";
import "../styles.css";

// Datos sintéticos solo para QA: un tablero de apuntes en memoria con la misma API del backend
// (listado con filtros, resumen, categorías y mutaciones). ?vista=lista abre la vista de lista.
const hace = (horas) => new Date(Date.now() - horas * 3600000).toISOString();
let nextId = 1;
const nota = (content, extra = {}, horas = 1) => ({
  id: nextId, title: "", content, color: "default", category: "", is_pinned: false, is_archived: false,
  sort_order: nextId++ * 1000, created_at: hace(horas + 2), updated_at: hace(horas), links: [], ...extra
});
const notes = [
  nota("Revisar con Sayma los barrios que faltan del reparto antes del viernes.\nLlevar la lista impresa.", { title: "Reparto de octubre", color: "azul", category: "Entregas", is_pinned: true }, 0.2),
  nota("Fontanero de turno: 9988-4455\nOficina técnica: +504 2782-1234", { title: "Teléfonos de guardia", color: "verde", category: "Contactos", is_pinned: true }, 30),
  nota("Clave 42-34-01-02 reporta fuga en la acera. Pasar a inspección esta semana.", { color: "crema", category: "Inspecciones" }, 2),
  nota("Pedir cotización de 40 medidores de ½ pulgada.", { title: "Compras", category: "Proveedores" }, 5),
  nota("Reunión con gerencia el lunes 9:00 — llevar el informe de cartera y el avance del mes.", { title: "Gerencia", color: "violeta", category: "Reuniones" }, 26),
  nota("Barrio Suyapa: 4 sobrantes en el lote 41. Confirmar direcciones.", { category: "Entregas" }, 50),
  nota("https://www.controlaguas.com/manual — compartir con los nuevos técnicos.", { title: "Manual de la app", color: "gris" }, 80),
  nota("Ferretería El Progreso entrega tubería PVC los martes.", { category: "Proveedores", color: "crema" }, 120),
  nota("Actualizar el padrón con las altas de septiembre.", { title: "Padrón", category: "Cartera" }, 200),
  nota("Llamar a Elmer por la ruta de la colonia Isidro Pineda.", { category: "Entregas", color: "azul" }, 400),
  nota("Archivo viejo de pruebas de impresión.", { is_archived: true, category: "Cartera" }, 900)
];

const fold = (value) => String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const respond = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
const active = () => notes.filter((item) => !item.deleted);

const summary = () => {
  const list = active();
  const colores = {};
  const cats = new Map();
  list.filter((item) => !item.is_archived).forEach((item) => {
    colores[item.color] = (colores[item.color] || 0) + 1;
    if (item.category) cats.set(item.category, (cats.get(item.category) || 0) + 1);
  });
  return {
    activos: list.filter((item) => !item.is_archived).length,
    fijados: list.filter((item) => !item.is_archived && item.is_pinned).length,
    archivados: list.filter((item) => item.is_archived).length,
    semana: list.filter((item) => !item.is_archived && Date.now() - new Date(item.created_at) < 7 * 86400000).length,
    colores,
    categorias: [...cats.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([nombre, total]) => ({ nombre, total }))
  };
};

const apiFetch = (path, options = {}) => {
  const url = new URL(path, "http://qa.local");
  const method = options.method || "GET";
  const body = options.body ? JSON.parse(options.body) : {};
  if (url.pathname === "/admin/notes/summary") return respond(summary());
  if (url.pathname === "/admin/notes/categories") return respond({ items: summary().categorias.map((item) => item.nombre) });
  if (url.pathname === "/admin/notes" && method === "GET") {
    const p = url.searchParams;
    const sort = p.get("sort") || "manual";
    const items = active()
      .filter((item) => item.is_archived === (p.get("archived") === "1"))
      .filter((item) => p.get("pinned") !== "1" || item.is_pinned)
      .filter((item) => !p.get("color") || item.color === p.get("color"))
      .filter((item) => !p.get("category") || fold(item.category) === fold(p.get("category")))
      .filter((item) => !p.get("q") || [item.title, item.content, item.category].some((field) => fold(field).includes(fold(p.get("q")))))
      .sort((a, b) => (sort === "manual" ? a.sort_order - b.sort_order : new Date(b[sort === "created" ? "created_at" : "updated_at"]) - new Date(a[sort === "created" ? "created_at" : "updated_at"])));
    return respond({ items, next_cursor: null, sort });
  }
  if (url.pathname === "/admin/notes" && method === "POST") {
    const created = nota(body.content, { title: body.title || "", color: body.color || "default", category: body.category || "", sort_order: Math.min(...notes.map((item) => item.sort_order)) - 1000 }, 0);
    created.created_at = created.updated_at;
    notes.push(created);
    return respond(created, 201);
  }
  const match = url.pathname.match(/^\/admin\/notes\/(\d+)(?:\/(\w+))?$/);
  const target = match && notes.find((item) => item.id === Number(match[1]));
  if (!target) return respond({ message: "Apunte no encontrado." }, 404);
  const action = match[2];
  if (method === "DELETE") { target.deleted = true; return respond({ ok: true }); }
  if (action === "restore") { target.deleted = false; return respond(target); }
  if (action === "duplicate") { const copy = { ...target, id: nextId++, is_pinned: false, sort_order: target.sort_order + 1, created_at: hace(0), updated_at: hace(0) }; notes.push(copy); return respond(copy, 201); }
  if (action === "move") {
    const before = notes.find((item) => item.id === body.before_id);
    const after = notes.find((item) => item.id === body.after_id);
    target.sort_order = before && after ? (before.sort_order + after.sort_order) / 2 : before ? before.sort_order + 1000 : after ? after.sort_order - 1000 : target.sort_order;
    return respond(target);
  }
  const { expected_updated_at: _expected, ...changes } = body;
  Object.assign(target, changes);
  if (changes.is_archived) target.is_pinned = false;
  if ("content" in changes || "title" in changes) target.updated_at = new Date().toISOString();
  return respond(target);
};

const params = new URLSearchParams(location.search);
try {
  window.localStorage.setItem("aguas.notes.density.v1", params.get("vista") === "lista" ? "list" : "grid");
  window.localStorage.setItem("aguas.notes.sort.v1", params.get("orden") || "manual");
} catch { /* sin almacenamiento local */ }

// ?oscuro=1 pinta en modo oscuro; ?filtro=Entregas activa esa categoría; ?nuevo=1 abre la creación rápida.
const oscuro = params.get("oscuro") === "1";
if (oscuro) document.body.style.background = "#0b1520";
setTimeout(() => {
  const filtro = params.get("filtro");
  if (filtro) [...document.querySelectorAll(".notes-category-filter")].find((button) => button.textContent.startsWith(filtro))?.click();
  if (params.get("nuevo")) setTimeout(() => document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "n", bubbles: true })), 300);
}, 600);

ReactDOM.createRoot(document.getElementById("root")).render(<div className={oscuro ? "dark" : ""} style={{ minHeight: "100vh", background: oscuro ? "#0b1520" : "transparent" }}><NotesPage apiFetch={apiFetch} /></div>);
