export const waitForMapTiles = async (mapNode, layers, timeout = 5000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const tiles = Array.from(mapNode.querySelectorAll(".leaflet-tile"));
    const tilesReady = tiles.length > 0 && tiles.every((tile) => tile.complete && tile.naturalWidth);
    const layersReady = layers.every((layer) => !layer?.isLoading?.());
    if (tilesReady && layersReady) return;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
};

export const captureLeafletMap = (mapNode, { connectMarkers = false } = {}) => {
  const bounds = mapNode.getBoundingClientRect();
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bounds.width * scale);
  canvas.height = Math.round(bounds.height * scale);
  const context = canvas.getContext("2d");
  context.scale(scale, scale);
  context.fillStyle = "#dce7f2";
  context.fillRect(0, 0, bounds.width, bounds.height);

  mapNode.querySelectorAll(".leaflet-tile-loaded").forEach((tile) => {
    if (!tile.complete || !tile.naturalWidth) return;
    const tileBounds = tile.getBoundingClientRect();
    context.drawImage(tile, tileBounds.left - bounds.left, tileBounds.top - bounds.top, tileBounds.width, tileBounds.height);
  });

  const markers = Array.from(mapNode.querySelectorAll(".map-print-marker"));
  const centers = markers.map((marker) => {
    const markerBounds = marker.getBoundingClientRect();
    return {
      marker,
      x: markerBounds.left - bounds.left + markerBounds.width / 2,
      y: markerBounds.top - bounds.top + markerBounds.height / 2
    };
  });

  if (connectMarkers && centers.length > 1) {
    context.lineJoin = "round";
    context.lineCap = "round";
    context.beginPath();
    centers.forEach(({ x, y }, index) => (index ? context.lineTo(x, y) : context.moveTo(x, y)));
    context.lineWidth = 7;
    context.strokeStyle = "rgba(255,255,255,.9)";
    context.stroke();
    context.lineWidth = 3;
    context.strokeStyle = "#1576d1";
    context.stroke();
  }

  centers.forEach(({ marker, x, y }) => {
    const markerBounds = marker.getBoundingClientRect();
    const markerStyle = window.getComputedStyle(marker);
    const radius = markerBounds.width / 2;
    const outline = Number.parseFloat(markerStyle.getPropertyValue("--outline-width")) || 0;
    context.beginPath();
    context.arc(x, y, radius + outline, 0, Math.PI * 2);
    context.fillStyle = markerStyle.getPropertyValue("--outline-color") || "#ffffff";
    context.fill();
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = markerStyle.backgroundColor || "#1576d1";
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = "#ffffff";
    context.stroke();
    if (marker.textContent) {
      context.fillStyle = "#ffffff";
      context.font = "800 9px Arial";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(marker.textContent, x, y + 0.5);
    }
  });

  return canvas.toDataURL("image/jpeg", 0.94);
};
