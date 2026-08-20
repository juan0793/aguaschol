const ROLE_PERMISSIONS = {
  admin: ["read", "createPoint", "editPoint", "deletePoint", "export", "print", "import", "admin"],
  operator: ["read", "createPoint", "editPoint", "export", "print"],
  validadora_campo: ["read", "createPoint", "print"],
  transport: ["read"]
};

export const getGisPermissions = (user = {}) => ROLE_PERMISSIONS[user.role] || [];
