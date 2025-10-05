// src/utils/signaling.js
import { log } from "./logger";

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
    log.info("Signaling", "Using custom signaling URL from .env:", custom);
    base = custom;
  } else if (isLocal) {
    base = `ws://${window.location.hostname}:8080/ws`;
    log.info("Signaling", "Running locally, using:", base);
  } else {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    base = `${proto}://${window.location.host}/ws`;
    log.info("Signaling", "Using dynamic base:", base);
  }

  const url = `${base}?room=${encodeURIComponent(room)}`;
  log.info("Signaling", "Connecting to:", url);
  const socket = new WebSocket(url);

  // --- Events ---
  socket.onopen = () => {
    log.success("Signaling", "WebSocket OPEN:", url);
    if (typeof onOpen === "function") {
      try {
        onOpen();
      } catch (err) {
        log.error("Signaling", "onOpen callback error:", err);
      }
    }
  };

  socket.onerror = (err) => {
    log.error("Signaling", "WebSocket ERROR:", err);
    // Also trigger onClose so caller can clean up
    if (typeof onClose === "function") {
      try {
        onClose(err);
      } catch (cbErr) {
        log.error("Signaling", "onClose callback error:", cbErr);
      }
    }
  };

  socket.onclose = (event) => {
    log.warn(
      "Signaling",
      `WebSocket CLOSED (code=${event.code}, reason=${event.reason || "no reason"})`
    );
    if (typeof onClose === "function") {
      try {
        onClose(event);
      } catch (cbErr) {
        log.error("Signaling", "onClose callback error:", cbErr);
      }
    }
  };

  // Optional: catch any message to debug signaling traffic
  socket.onmessage = (msg) => {
    log.debug("Signaling", "Incoming message:", msg.data);
  };

  return socket;
}
