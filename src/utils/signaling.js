export function createSocket(room, cleanupPeer, onMessageHandler) {
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  const base = isLocal
    ? `ws://${window.location.hostname}:8080/ws`
    : `wss://${window.location.hostname}/ws`;

  const socketUrl = `${base}?room=${encodeURIComponent(room)}`;
  const socket = new WebSocket(socketUrl);

  socket.onerror = (err) => console.error("❌ WebSocket error:", err);
  socket.onclose = () => cleanupPeer();

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    onMessageHandler(data);
  };

  return socket;
}
