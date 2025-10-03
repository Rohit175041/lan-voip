export function createWebSocket(room, onClose, onOpen) {
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  const base =
    process.env.REACT_APP_SIGNALING_URL ||
    (isLocal
      ? `ws://${window.location.hostname}:8080/ws`
      : `wss://${window.location.hostname}/ws`);

  const socket = new WebSocket(`${base}?room=${encodeURIComponent(room)}`);

  socket.onopen = () => {
    console.log("🔗 WebSocket connected to signaling server");
    if (typeof onOpen === "function") onOpen();
  };

  socket.onerror = (err) => console.error("❌ WebSocket error:", err);

  socket.onclose = () => {
    console.warn("⚠️ WebSocket closed");
    if (typeof onClose === "function") onClose();
  };

  return socket;
}
