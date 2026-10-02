import { roleLabel } from "../../utils/formatting";

export function createUserAdminActions({
  apiFetch,
  clearSession,
  latestUserResult,
  loadAuditLogs,
  loadUsers,
  setCreatingUser,
  setLatestUserResult,
  setPendingDeleteUser,
  setSavingUserRoleId,
  setSelectedUserId,
  setUserForm,
  setUsers,
  showAlert,
  userForm
}) {
  const handleUserFormChange = (event) => {
    const { name, value } = event.target;
    setUserForm((current) => ({ ...current, [name]: value }));
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setCreatingUser(true);

    try {
      const response = await apiFetch("/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(userForm)
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No se pudo crear el usuario.");
      }

      setLatestUserResult(data);
      setSelectedUserId(data.user?.id ?? null);
      setUserForm({
        full_name: "",
        email: "",
        role: "operator"
      });
      showAlert("Usuario creado satisfactoriamente.");
      loadUsers();
      loadAuditLogs();
    } catch (error) {
      showAlert(error.message || "No se pudo crear el usuario.");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!user?.id) return;

    try {
      const response = await apiFetch(`/users/${user.id}`, {
        method: "DELETE"
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No se pudo eliminar el usuario.");
      }

      setUsers((current) => current.filter((item) => item.id !== user.id));
      setSelectedUserId((current) => (current === user.id ? null : current));
      if (latestUserResult?.user?.id === user.id) {
        setLatestUserResult(null);
      }
      setPendingDeleteUser(null);
      showAlert(`Usuario ${user.username} eliminado.`);
      loadUsers();
      loadAuditLogs();
    } catch (error) {
      showAlert(error.message || "No se pudo eliminar el usuario.");
    }
  };

  const handleResetUserPassword = async (user) => {
    if (!user?.id) return;

    try {
      const response = await apiFetch(`/users/${user.id}/reset-password`, {
        method: "POST"
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No se pudo regenerar la contrasena temporal.");
      }

      setLatestUserResult(data);
      setSelectedUserId(data.user?.id ?? user.id);
      setUsers((current) =>
        current.map((item) =>
          item.id === user.id
            ? {
                ...item,
                ...data.user
              }
            : item
        )
      );
      showAlert(`Se genero una nueva contrasena temporal para ${data.user?.username || user.username}.`);
      loadAuditLogs();
    } catch (error) {
      showAlert(error.message || "No se pudo regenerar la contrasena temporal.");
    }
  };

  const handleUpdateUserRole = async (user, role) => {
    if (!user?.id || !role || user.role === role) return;

    setSavingUserRoleId(user.id);

    try {
      const response = await apiFetch(`/users/${user.id}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ role })
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No se pudo cambiar el perfil del usuario.");
      }

      setUsers((current) => current.map((item) => (item.id === data.id ? { ...item, ...data } : item)));
      if (latestUserResult?.user?.id === data.id) {
        setLatestUserResult((current) => ({
          ...current,
          user: {
            ...current.user,
            ...data
          }
        }));
      }
      setSelectedUserId(data.id);
      showAlert(`Perfil de ${data.username} actualizado a ${roleLabel(data.role)}.`);
      loadUsers({ silent: true });
      loadAuditLogs();
    } catch (error) {
      showAlert(error.message || "No se pudo cambiar el perfil del usuario.");
    } finally {
      setSavingUserRoleId(null);
    }
  };

  // Corrige el nombre completo. Devuelve true si se guardó, para cerrar el editor.
  const handleUpdateUserName = async (user, fullName) => {
    const nombre = String(fullName || "").replace(/\s+/g, " ").trim();
    if (!user?.id || !nombre || nombre === user.full_name) return true;
    try {
      const response = await apiFetch(`/users/${user.id}/name`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: nombre })
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return false;
        }
        throw new Error(data.message || "No se pudo corregir el nombre.");
      }
      if (data.user) {
        setUsers((current) => current.map((item) => (item.id === data.user.id ? { ...item, ...data.user } : item)));
        if (latestUserResult?.user?.id === data.user.id) {
          setLatestUserResult((current) => ({ ...current, user: { ...current.user, ...data.user } }));
        }
      }
      const extra = [
        data.fichas ? `${data.fichas} ${data.fichas === 1 ? "ficha" : "fichas"} donde figura como responsable` : "",
        data.personal ? "su registro en Personal de campo" : ""
      ].filter(Boolean).join(" y ");
      showAlert([
        `Nombre actualizado: ${nombre}.`,
        extra ? `También se corrigió en ${extra}.` : "",
        data.fichasOmitidas ? "Las fichas no se cambiaron porque otro usuario tenía el mismo nombre; corrígelas desde cada ficha." : ""
      ].filter(Boolean).join(" "));
      loadUsers({ silent: true });
      loadAuditLogs();
      return true;
    } catch (error) {
      showAlert(error.message || "No se pudo corregir el nombre.");
      return false;
    }
  };

  return {
    handleUserFormChange,
    handleCreateUser,
    handleDeleteUser,
    handleResetUserPassword,
    handleUpdateUserRole,
    handleUpdateUserName
  };
}
