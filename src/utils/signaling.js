// utils/signaling.js
export function createWebSocket(room, onClose, onOpen) {
  const custom = process.env.REACT_APP_SIGNALING_URL;
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  let base;
  if (custom) {
    base = custom;
  } else if (isLocal) {
    base = `ws://${window.location.hostname}:8080/ws`;
  } else {
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
