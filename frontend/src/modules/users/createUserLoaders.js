export function createUserLoaders({
  apiFetch,
  clearSession,
  isAdmin,
  isAuthenticated,
  setLoadingUsers,
  setSelectedUserId,
  setUsers,
  showAlert
}) {
  const loadUsers = async ({ silent = false } = {}) => {
    if (!isAuthenticated || !isAdmin) return;
    if (!silent) {
      setLoadingUsers(true);
    }

    try {
      const response = await apiFetch("/users", { revalidate: true });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          showAlert("La sesion vencio. Ingresa nuevamente.");
          return;
        }

        throw new Error(data.message || "No fue posible cargar los usuarios.");
      }

      setUsers(Array.isArray(data) ? data : []);
      setSelectedUserId((current) => {
        const nextUsers = Array.isArray(data) ? data : [];
        if (!nextUsers.length) return null;
        return nextUsers.some((user) => user.id === current) ? current : nextUsers[0].id;
      });
    } catch (error) {
      if (!silent) {
        setUsers([]);
        setSelectedUserId(null);
        showAlert(error.message || "No fue posible cargar los usuarios.");
      }
    } finally {
      if (!silent) {
        setLoadingUsers(false);
      }
    }
  };

  return { loadUsers };
}
