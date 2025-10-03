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

  socket.onerror = (err) => {
    console.error("❌ WebSocket error:", err);
    // Optional: force cleanup if error occurs
    if (typeof onClose === "function") onClose(err);
  };

  socket.onclose = (event) => {
    console.warn(`⚠️ WebSocket closed (code=${event.code}, reason=${event.reason || "no reason"})`);
    if (typeof onClose === "function") onClose(event);
  };

  return socket;
}
