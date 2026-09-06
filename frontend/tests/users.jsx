import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { UsersContent, UsersSidebar } from "../src/components/users/UsersWorkspace.jsx";
import "../src/styles.css";

const users = [
  { id: 1, full_name: "Administrador del sistema", username: "admin", email: "admin@local.aguaschol", role: "admin", is_online: true, active_sessions: 3, last_login_at: new Date().toISOString() },
  { id: 2, full_name: "Luisa Herrera", username: "solizf527", email: "solizf527@gmail.com", role: "operator", is_online: true, active_sessions: 2, last_login_at: new Date().toISOString() },
  { id: 3, full_name: "Nombre de usuario especialmente largo para verificar el ajuste", username: "usuario.extenso", email: "correo.muy.largo.para.pruebas@aguaschol.example", role: "validadora_campo", is_online: false, active_sessions: 0, last_login_at: null }
];
const format = (value) => value ? new Date(value).toLocaleString("es-HN") : "Sin acceso";
const role = (value) => ({ admin: "Administrador", operator: "Operador", validadora_campo: "Validación campo" }[value] || value);
const apiFetch = async () => ({ ok: true, json: async () => [] });

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
