export function createWebSocket(room, onClose) {
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  const base =
    process.env.REACT_APP_SIGNALING_URL ||
    (isLocal
      ? `ws://${window.location.hostname}:8080/ws`
      : `wss://${window.location.hostname}/ws`);

  const socket = new WebSocket(`${base}?room=${encodeURIComponent(room)}`);
  socket.onerror = (err) => console.error("❌ WebSocket error:", err);
  socket.onclose = onClose;
  return socket;
}
