const USER_ROLES = new Set(["admin", "operator", "transport", "validadora_campo", "gerente"]);

export const normalizeUserRole = (role) => {
  if (typeof role !== "string" || !USER_ROLES.has(role.trim())) {
    throw Object.assign(new Error("Perfil de usuario no válido."), { status: 400 });
  }
  return role.trim();
};
