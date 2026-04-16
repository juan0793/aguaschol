const iconPaths = {
  dashboard:
    "M4 5.5A1.5 1.5 0 0 1 5.5 4h5A1.5 1.5 0 0 1 12 5.5v5A1.5 1.5 0 0 1 10.5 12h-5A1.5 1.5 0 0 1 4 10.5zM14 5.5A1.5 1.5 0 0 1 15.5 4h3A1.5 1.5 0 0 1 20 5.5v3A1.5 1.5 0 0 1 18.5 10h-3A1.5 1.5 0 0 1 14 8.5zM14 14.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 20 14.5v5a1.5 1.5 0 0 1-1.5 1.5h-3a1.5 1.5 0 0 1-1.5-1.5zM4 15.5A1.5 1.5 0 0 1 5.5 14h5A1.5 1.5 0 0 1 12 15.5v3A1.5 1.5 0 0 1 10.5 20h-5A1.5 1.5 0 0 1 4 18.5z",
  home:
    "M4 11.5 12 5l8 6.5v7A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5zM9 20v-5h6v5",
  records:
    "M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5z M8 8h8M8 12h8M8 16h5",
  users:
    "M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4m0 2c-3.8 0-7 2.1-7 4.7V20h14v-1.3C19 16.1 15.8 14 12 14",
  logs:
    "M7 5.5h10M7 10.5h10M7 15.5h6M6.5 3h11A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3",
  refresh:
    "M19 6v5h-5M5 18v-5h5M18 11a6.5 6.5 0 0 0-11-3.8L5 11M6 13a6.5 6.5 0 0 0 11 3.8L19 13",
  logout:
    "M14 7V5.5A2.5 2.5 0 0 0 11.5 3h-5A2.5 2.5 0 0 0 4 5.5v13A2.5 2.5 0 0 0 6.5 21h5a2.5 2.5 0 0 0 2.5-2.5V17M10 12h10m0 0-3-3m3 3-3 3",
  search:
    "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14m9 3-4.2-4.2",
  arrowLeft:
    "M15 18l-6-6 6-6M9 12h10",
  arrowRight:
    "M9 18l6-6-6-6M5 12h10",
  map:
    "M12 21s7-4.4 7-10a7 7 0 1 0-14 0c0 5.6 7 10 7 10m0-7.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5",
  transport:
    "M4 8h11l2.2 2.2V16h-1.7a2.8 2.8 0 0 1-5.5 0H9.5a2.8 2.8 0 0 1-5.5 0H3V9a1 1 0 0 1 1-1m2.8 8.2a1.2 1.2 0 1 0-2.4 0 1.2 1.2 0 0 0 2.4 0m9.5 0a1.2 1.2 0 1 0-2.4 0 1.2 1.2 0 0 0 2.4 0",
  water:
    "M12 3.5c2.6 3 4.8 5.7 4.8 8.5A4.8 4.8 0 1 1 7.2 12c0-2.8 2.2-5.5 4.8-8.5",
  sewer:
    "M4 13h16M7 13V8h10v5M9 8V5h6v3M8 17h8M10 20h4",
  broom:
    "M8 4l8 8M13 3l8 8M5 15l4 4M3 17l4 4M10 9l-6 6",
  waste:
    "M9 5h6M4 7h16M8 7l.7 11.2A2 2 0 0 0 10.7 20h2.6a2 2 0 0 0 2-1.8L16 7M10 10v6M14 10v6M10 3h4l1 2H9z",
  copy:
    "M9 9h9v11H9zM6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1",
  plus:
    "M12 5v14M5 12h14",
  archive:
    "M4 7.5h16M9 12l3 3 3-3M12 15V8M6.5 4h11A1.5 1.5 0 0 1 19 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5v-13A1.5 1.5 0 0 1 6.5 4",
  history:
    "M12 7v5l3 2M12 22a10 10 0 1 1 10-10A10 10 0 0 1 12 22",
  activity:
    "M4 13h3l2-5 3 10 2-5h4",
  warning:
    "M12 4 21 20H3L12 4m0 5v4m0 4h.01",
  success:
    "M20 6 9 17l-5-5",
  userCreated:
    "M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4m7.5 6.5L21 20l-2.5 2.5-2-2M5 20v-1.3C5 16.1 8.2 14 12 14c1.3 0 2.6.2 3.7.6",
  auth:
    "M12 3l7 4v5c0 4.3-2.9 8.2-7 9-4.1-.8-7-4.7-7-9V7z",
  more:
    "M5 12a1.5 1.5 0 1 0 0-.01M12 12a1.5 1.5 0 1 0 0-.01M19 12a1.5 1.5 0 1 0 0-.01"
};

export const Icon = ({ name, className = "" }) => (
  <span className={`app-icon ${className}`.trim()} aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={iconPaths[name] || iconPaths.records} />
    </svg>
  </span>
);

export const actionIconName = (action) =>
  (
    {
      "auth.login": "auth",
      "auth.logout": "logout",
      "auth.password_changed": "success",
      "user.created": "userCreated",
      "padron.updated": "refresh",
      "map_point.created": "map",
      "map_point.deleted": "archive",
      "transport.route_created": "transport",
      "transport.route_updated": "transport",
      "transport.route_started": "transport",
      "transport.route_completed": "success",
      "transport.position_logged": "map",
      "transport.route_alert": "warning",
      "inmueble.created": "plus",
      "inmueble.updated": "records",
      "inmueble.archived": "archive",
      "inmueble.deleted": "logout",
      "inmueble.restored": "refresh",
      "inmueble.photo_attached": "activity"
    }[action] ?? "activity"
  );
