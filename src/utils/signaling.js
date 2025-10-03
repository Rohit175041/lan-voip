export function createWebSocket(room, onClose, onOpen) {
  // Allow explicit signaling server URL via env var
  const custom = process.env.REACT_APP_SIGNALING_URL;

  // Detect local dev
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  let base;
  if (custom) {
    base = custom;                       // use explicit env if provided
  } else if (isLocal) {
    base = `ws://${window.location.hostname}:8080/ws`; // dev server
  } else {
    // page is HTTPS -> use WSS, otherwise WS
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    base = `${proto}://${window.location.host}/ws`;
  }

  const url = `${base}?room=${encodeURIComponent(room)}`;
  const socket = new WebSocket(url);

  socket.onopen = () => {
    console.log("🔗 WebSocket connected:", url);
    if (typeof onOpen === "function") onOpen();
  };

  socket.onerror = (err) => {
    console.error("❌ WebSocket error:", err);
    if (typeof onClose === "function") onClose(err);
  };

  socket.onclose = (event) => {
    console.warn(
      `⚠️ WebSocket closed (code=${event.code}, reason=${event.reason || "no reason"})`
    );
    if (typeof onClose === "function") onClose(event);
  };

  return socket;
}
