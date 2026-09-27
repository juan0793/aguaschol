import { useCallback, useEffect, useState } from "react";
import { getWorkspaceViewByRole } from "../utils/appShell";

export function useAppShellState({ session }) {
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [notificationUserId, setNotificationUserId] = useState(null);
  const [workspaceView, setWorkspaceView] = useState(() => getWorkspaceViewByRole(session?.user?.role));
  const [crossModuleFocus, setCrossModuleFocus] = useState(null);
  // Barra superior del módulo Clandestinos: búsqueda por clave y estado de carga.
  const [clandestinosCommand, setClandestinosCommand] = useState(null);
  const [clandestinosStatus, setClandestinosStatus] = useState(null);
  const [clandestinosUpdatedAt, setClandestinosUpdatedAt] = useState(null);
  const clandestinosBusy = Boolean(clandestinosStatus?.busy);
  useEffect(() => {
    if (clandestinosStatus && !clandestinosBusy) setClandestinosUpdatedAt(new Date());
  }, [clandestinosBusy, clandestinosStatus]);
  const [cargandoDatos, setCargandoDatos] = useState(false);

  const [showMobileModuleMenu, setShowMobileModuleMenu] = useState(false);
  const closeMobileModuleMenu = useCallback(() => setShowMobileModuleMenu(false), []);

  return {
    unreadMessagesCount,
    setUnreadMessagesCount,
    notificationUserId,
    setNotificationUserId,
    workspaceView,
    setWorkspaceView,
    crossModuleFocus,
    setCrossModuleFocus,
    clandestinosCommand,
    setClandestinosCommand,
    clandestinosStatus,
    setClandestinosStatus,
    clandestinosUpdatedAt,
    clandestinosBusy,
    cargandoDatos,
    setCargandoDatos,
    showMobileModuleMenu,
    setShowMobileModuleMenu,
    closeMobileModuleMenu
  };
}
