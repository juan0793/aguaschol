export const canReadInstitutionally = (user) => ["admin", "gerente"].includes(user?.role);

export const assertOperationalWrite = (user) => {
  if (user?.role === "gerente" || user?.preview) {
    throw Object.assign(new Error("Gerencia General tiene acceso de solo lectura."), { status: 403 });
  }
};
