import { useState } from "react";

export function useUsersState() {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState(null);
  const [pendingDeleteRecord, setPendingDeleteRecord] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [savingUserRoleId, setSavingUserRoleId] = useState(null);
  const [userForm, setUserForm] = useState({
    full_name: "",
    email: "",
    role: "operator"
  });
  const [latestUserResult, setLatestUserResult] = useState(null);

  return {
    users,
    setUsers,
    selectedUserId,
    setSelectedUserId,
    pendingDeleteUser,
    setPendingDeleteUser,
    pendingDeleteRecord,
    setPendingDeleteRecord,
    loadingUsers,
    setLoadingUsers,
    creatingUser,
    setCreatingUser,
    savingUserRoleId,
    setSavingUserRoleId,
    userForm,
    setUserForm,
    latestUserResult,
    setLatestUserResult
  };
}
