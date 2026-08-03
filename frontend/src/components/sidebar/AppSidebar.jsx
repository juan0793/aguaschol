import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";

const GROUPS_STORAGE_KEY = "controlAguas.sidebarGroups";

const loadGroups = () => {
  try {
    return JSON.parse(window.localStorage.getItem(GROUPS_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
};

export default function AppSidebar({
  sections,
  activeKey,
  collapsed,
  mobileOpen,
  logo,
  userName,
  userRole,
  onToggleCollapsed,
  onNavigate,
  onCloseMobile,
  onLogout
}) {
  const sidebarRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [openGroups, setOpenGroups] = useState(loadGroups);
  const [flyoutKey, setFlyoutKey] = useState("");
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 768px)").matches);
  const effectiveCollapsed = collapsed && !mobileOpen;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(media.matches);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    const activeSection = sections.find((section) => section.items.some((item) => item.key === activeKey));
    if (activeSection?.collapsible) {
      setOpenGroups((current) => current[activeSection.key] ? current : { ...current, [activeSection.key]: true });
    }
  }, [activeKey, sections]);

  useEffect(() => {
    window.localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(openGroups));
  }, [openGroups]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    previousFocusRef.current = document.activeElement;
    document.body.style.overflow = "hidden";
    (sidebarRef.current?.querySelector(".control-sidebar-item.is-active") || sidebarRef.current?.querySelector(".control-sidebar-navigation button"))?.focus();
    return () => {
      document.body.style.overflow = "";
      previousFocusRef.current?.focus?.();
    };
  }, [mobileOpen]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setFlyoutKey("");
        onCloseMobile();
        return;
      }
      if (!mobileOpen || event.key !== "Tab") return;
      const buttons = [...(sidebarRef.current?.querySelectorAll("button:not(:disabled)") || [])];
      if (!buttons.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const handlePointerDown = (event) => {
      if (flyoutKey && !sidebarRef.current?.contains(event.target)) setFlyoutKey("");
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [flyoutKey, mobileOpen, onCloseMobile]);

  const navigate = (key) => {
    onNavigate(key);
    setFlyoutKey("");
    onCloseMobile();
  };
  const toggleGroup = (section) => {
    if (effectiveCollapsed) {
      setFlyoutKey((current) => current === section.key ? "" : section.key);
      return;
    }
    setOpenGroups((current) => ({ ...current, [section.key]: !current[section.key] }));
  };
  const renderItem = (item, flyout = false) => {
    const active = activeKey === item.key;
    return (
      <button
        key={item.key}
        type="button"
        className={`control-sidebar-item ${active ? "is-active" : ""} ${flyout ? "is-flyout" : ""}`}
        aria-current={active ? "page" : undefined}
        aria-label={effectiveCollapsed || flyout ? item.label : undefined}
        data-tooltip={effectiveCollapsed && !flyout ? item.label : undefined}
        onClick={() => navigate(item.key)}
      >
        <Icon name={item.icon} />
        <span className="control-sidebar-item-copy"><strong>{item.label}</strong>{item.helper ? <small>{item.helper}</small> : null}</span>
        {item.badge !== null && item.badge !== undefined ? <span className="control-sidebar-badge" aria-label={`${item.badge} elementos`}>{item.badge}</span> : null}
      </button>
    );
  };

  return (
    <>
      <aside id="control-sidebar" ref={sidebarRef} className={`control-sidebar no-print ${effectiveCollapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-mobile-open" : ""}`} aria-label="Navegación principal" aria-hidden={isMobile && !mobileOpen ? "true" : undefined} inert={isMobile && !mobileOpen ? "" : undefined}>
        <header className="control-sidebar-header">
          <img src={logo} alt="Aguas de Choluteca" />
          <div><strong>Aguas de Choluteca</strong><span>Panel ejecutivo</span></div>
          <button type="button" className="control-sidebar-toggle" onClick={onToggleCollapsed} aria-label={effectiveCollapsed ? "Expandir menú lateral" : "Contraer menú lateral"} aria-pressed={effectiveCollapsed}><Icon name="arrowLeft" /></button>
        </header>
        <nav className="control-sidebar-navigation">
          {sections.map((section) => {
            const open = Boolean(openGroups[section.key]);
            const activeGroup = section.items.some((item) => item.key === activeKey);
            if (!section.collapsible) {
              return <section className="control-sidebar-section" key={section.key}><span className="control-sidebar-section-label">{section.title}</span>{section.items.map((item) => renderItem(item))}</section>;
            }
            return (
              <section className={`control-sidebar-section is-group ${activeGroup ? "has-active" : ""}`} key={section.key}>
                <button type="button" className="control-sidebar-group" aria-expanded={effectiveCollapsed ? flyoutKey === section.key : open} aria-controls={`sidebar-group-${section.key}`} data-tooltip={effectiveCollapsed ? section.title : undefined} onClick={() => toggleGroup(section)}>
                  <Icon name={section.icon} /><span>{section.title}</span><Icon name="arrowRight" className="control-sidebar-chevron" />
                </button>
                {!effectiveCollapsed && open ? <div id={`sidebar-group-${section.key}`} className="control-sidebar-group-items">{section.items.map((item) => renderItem(item))}</div> : null}
                {effectiveCollapsed && flyoutKey === section.key ? <div id={`sidebar-group-${section.key}`} className="control-sidebar-flyout" role="menu"><strong>{section.title}</strong>{section.items.map((item) => renderItem(item, true))}</div> : null}
              </section>
            );
          })}
        </nav>
        <footer className="control-sidebar-footer">
          <button type="button" className="control-sidebar-user" onClick={() => navigate("profile")} data-tooltip={effectiveCollapsed ? `${userName} · ${userRole}` : undefined}>
            <span>{String(userName || "U").trim().charAt(0).toUpperCase()}</span>
            <div><strong>{userName}</strong><small>{userRole}</small></div>
          </button>
          <button type="button" className="control-sidebar-logout" onClick={onLogout} aria-label="Cerrar sesión" data-tooltip={effectiveCollapsed ? "Cerrar sesión" : undefined}><Icon name="logout" /><span>Cerrar sesión</span></button>
        </footer>
      </aside>
      {mobileOpen ? <button type="button" className="control-sidebar-backdrop no-print" aria-label="Cerrar menú" onClick={onCloseMobile} /> : null}
    </>
  );
}
