// utils/signaling.js
/**
 * Create a WebSocket connection to the signaling server.
 *
 * @param {string} room       - Room/meeting ID
 * @param {Function} onClose  - Called when WS closes or errors
 * @param {Function} onOpen   - Called when WS connects
 */
export function createWebSocket(room, onClose, onOpen) {
  const custom = process.env.REACT_APP_SIGNALING_URL;
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  // --- Determine base URL ---
  let base;
  if (custom) {
    console.log("🌐 [Signaling] Using custom signaling URL from env:", custom);
    base = custom;
  } else if (isLocal) {
    base = `ws://${window.location.hostname}:8080/ws`;
    console.log("🌐 [Signaling] Running locally, using:", base);
  } else {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    base = `${proto}://${window.location.host}/ws`;
    console.log("🌐 [Signaling] Using dynamic base:", base);
  }

  const url = `${base}?room=${encodeURIComponent(room)}`;
  console.log("🚀 [Signaling] Connecting to:", url);
  const socket = new WebSocket(url);

  // --- Events ---
  socket.onopen = () => {
    console.log("✅ [Signaling] WebSocket OPEN:", url);
    if (typeof onOpen === "function") {
      try {
        onOpen();
      } catch (err) {
        console.error("⚠️ [Signaling] onOpen callback error:", err);
      }
    }
  };

  socket.onerror = (err) => {
    console.error("❌ [Signaling] WebSocket ERROR:", err);
    // Also trigger onClose so caller can clean up
    if (typeof onClose === "function") {
      try {
        onClose(err);
      } catch (cbErr) {
        console.error("⚠️ [Signaling] onClose callback error:", cbErr);
      }
    }
  };

  socket.onclose = (event) => {
    console.warn(
      `⚠️ [Signaling] WebSocket CLOSED (code=${event.code}, reason=${event.reason || "no reason"})`
    );
    if (typeof onClose === "function") {
      try {
        onClose(event);
      } catch (cbErr) {
        console.error("⚠️ [Signaling] onClose callback error:", cbErr);
      }
    }
  };

  // Optional: catch any message to debug signaling traffic
  socket.onmessage = (msg) => {
    console.log("📩 [Signaling] Incoming message:", msg.data);
  };

  return socket;
}
