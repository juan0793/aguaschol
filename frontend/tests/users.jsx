import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { UsersContent, UsersSidebar } from "../src/components/users/UsersWorkspace.jsx";
import "../src/styles.css";

const users = [
  { id: 1, full_name: "Administrador del sistema", username: "admin", email: "admin@local.aguaschol", role: "admin", is_online: true, active_sessions: 3, last_login_at: new Date().toISOString() },
  { id: 2, full_name: "Luisa Herrera", username: "solizf527", email: "solizf527@gmail.com", role: "operator", is_online: true, active_sessions: 2, last_login_at: new Date().toISOString() },
  { id: 3, full_name: "Nombre de usuario especialmente largo para verificar el ajuste", username: "usuario.extenso", email: "correo.muy.largo.para.pruebas@aguaschol.example", role: "validadora_campo", is_online: false, active_sessions: 0, last_login_at: null, accesos: 1 }
];
const format = (value) => value ? new Date(value).toLocaleString("es-HN") : "Sin acceso";
const role = (value) => ({ admin: "Administrador", operator: "Operador", validadora_campo: "Validación campo" }[value] || value);
// Accesos adicionales en memoria (Usuarios › Información del acceso). El usuario 3 es técnico.
const CATALOGO = [{ clave: "entregas.prioridad", modulo: "Control de entregas", titulo: "Barrios por prioridad", descripcion: "Ver la pestaña Prioridad con lo que falta del ciclo, imprimirla y guardarla en PDF. Nunca ve montos.", alcances: [{ valor: "todos", titulo: "Todos los barrios del reparto" }, { valor: "propios", titulo: "Solo sus barrios" }] }];
let accesos = { 3: [{ clave: "entregas.prioridad", alcance: "todos", vence: "2026-11-30", vigente: true, otorgado_por_nombre: "Administrador del sistema" }] };
const apiFetch = async (ruta = "", opciones = {}) => {
  const coincide = ruta.match(/^\/users\/(\d+)\/accesos(?:\/([^/]+))?$/);
  if (!coincide) return { ok: true, json: async () => [] };
  const id = Number(coincide[1]);
  const rol = users.find((user) => user.id === id)?.role;
  if (opciones.method === "PUT") {
    const cuerpo = JSON.parse(opciones.body || "{}");
    const clave = decodeURIComponent(coincide[2]);
    accesos[id] = [...(accesos[id] || []).filter((item) => item.clave !== clave), { clave, alcance: cuerpo.alcance || "todos", vence: cuerpo.vence || null, vigente: true, otorgado_por_nombre: "Administrador del sistema" }];
  }
  if (opciones.method === "DELETE") accesos[id] = (accesos[id] || []).filter((item) => item.clave !== decodeURIComponent(coincide[2]));
  return { ok: true, json: async () => ({ hoy: "2026-11-18", catalogo: rol === "validadora_campo" ? CATALOGO : [], accesos: accesos[id] || [] }) };
};

function QA() {
  const [selected, setSelected] = useState(users[0]);
  const [form, setForm] = useState({ full_name: "", email: "", role: "operator" });
  return <main className="admin-layout">
    <UsersSidebar loadingUsers={false} safeUsers={users} selectedUser={selected} setSelectedUserId={(id) => setSelected(users.find((user) => user.id === id))} roleLabel={role} />
    <section className="admin-content"><UsersContent apiFetch={apiFetch} creatingUser={false} handleCreateUser={(event) => event.preventDefault()} handleResetUserPassword={() => {}} handleUpdateUserRole={() => {}} handleUserFormChange={(event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))} latestUserResult={null} savingUserRoleId={null} selectedUser={selected} session={{ user: users[0] }} setPendingDeleteUser={(user) => alert(`Eliminar: ${user.full_name}`)} setUserForm={setForm} userForm={form} formatDateTime={format} roleLabel={role} safeUsers={users} showAlert={() => {}} /></section>
  </main>;
}

createRoot(document.getElementById("root")).render(<QA />);

const check = document.createElement("button");
check.textContent = "Comprobar búsqueda";
check.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:20";
check.onclick = async () => {
  const input = document.querySelector(".users-search input");
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  set.call(input, "luisa"); input.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  if (document.querySelectorAll(".user-list-card").length !== 1) throw new Error("La búsqueda no filtró el directorio");
  check.textContent = "Búsqueda OK";
};
document.body.append(check);
