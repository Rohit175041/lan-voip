// src/utils/webrtc.js
import { log } from "./logger";

/**
 * Create a WebRTC peer connection.
 *
 * @param {WebSocket} socket          - Signaling WebSocket.
 * @param {RefObject<HTMLVideoElement>} localVideo
 * @param {RefObject<HTMLVideoElement>} remoteVideo
 * @param {Function} onConnected      - Called when remote media is attached.
 */
export function createPeerConnection(socket, localVideo, remoteVideo, onConnected) {
  log.info("WebRTC", "Creating PeerConnection...");

  // --- Build ICE server list from .env ---
  const stunUrls = (process.env.REACT_APP_ICE_SERVERS || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean)
    .map((u) => ({ urls: u }));

  const turnUrl = process.env.REACT_APP_TURN_SERVER;
  const turnUser = process.env.REACT_APP_TURN_USERNAME;
  const turnPass = process.env.REACT_APP_TURN_PASSWORD;

  const iceServers = [...stunUrls];
  if (turnUrl) {
    iceServers.push({
      urls: turnUrl,
      username: turnUser || undefined,
      credential: turnPass || undefined,
    });
  }

  log.debug("WebRTC", "ICE servers:", iceServers);

  const pc = new RTCPeerConnection({ iceServers });

  // ---- ICE candidate generation ----
  pc.onicecandidate = (e) => {
    if (e.candidate) {
      log.debug("ICE", "Local candidate found:", e.candidate.candidate);
      if (socket?.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify({ ice: e.candidate }));
          log.success("Signaling", "Sent ICE candidate to remote peer");
        } catch (err) {
          log.error("Signaling", "Failed to send ICE candidate:", err);
        }
      } else {
        log.warn("Signaling", "Cannot send ICE — socket not open");
      }
    } else {
      log.info("ICE", "Candidate gathering finished.");
    }
  };

  // ---- ICE connection state changes ----
  pc.oniceconnectionstatechange = () => {
    log.info("ICE", "Connection state:", pc.iceConnectionState);
    if (pc.iceConnectionState === "failed") {
      log.warn("ICE", "Connection failed — TURN server might be required.");
    }
    if (pc.iceConnectionState === "disconnected") {
      log.warn("ICE", "Disconnected — network might be unstable.");
    }
  };

  // ---- Peer overall connection state ----
  pc.onconnectionstatechange = () => {
    log.debug("Peer", "Connection state:", pc.connectionState);
  };

  // ---- Remote track (video/audio) ----
  pc.ontrack = (e) => {
    log.success("Peer", "Remote track received:", e.streams?.length, "stream(s)");
    if (remoteVideo?.current && e.streams[0]) {
      remoteVideo.current.srcObject = e.streams[0];
      log.success("Peer", "Remote video stream attached successfully.");
    }
    onConnected?.();
  };

  return pc;
}

/**
 * Caller creates the DataChannel for chat & file transfer.
 */
export function createChatChannel(pc, onMessage) {
  log.info("DataChannel", "Creating outbound DataChannel...");
  const dc = pc.createDataChannel("chat");
  dc.binaryType = "arraybuffer";

  dc.onopen = () => log.success("DataChannel", "Open (caller)");
  dc.onclose = () => log.warn("DataChannel", "Closed");
  dc.onerror = (err) => log.error("DataChannel", "Error:", err);
  dc.onmessage = (e) => {
    log.debug(
      "DataChannel",
      "Message received:",
      e.data instanceof ArrayBuffer ? "ArrayBuffer" : e.data
    );
    onMessage?.(e.data);
  };

  return dc;
}

/**
 * Cleanup PeerConnection and WebSocket safely.
 */
export function cleanupPeerConnection(pc, ws, localVideo, remoteVideo) {
  log.info("Cleanup", "Closing PeerConnection and WebSocket...");

  // Stop local tracks
  if (localVideo?.current?.srcObject) {
    log.debug("Cleanup", "Stopping local media tracks...");
    localVideo.current.srcObject.getTracks().forEach((t) => t.stop());
    localVideo.current.srcObject = null;
  }

  // Clear remote video
  if (remoteVideo?.current) {
    log.debug("Cleanup", "Clearing remote video element...");
    remoteVideo.current.srcObject = null;
  }

  // Close peer connection
  try {
    pc?.getSenders()?.forEach((s) => s.track?.stop());
    pc?.close();
    log.success("Cleanup", "PeerConnection closed successfully.");
  } catch (err) {
    log.warn("Cleanup", "Error closing PeerConnection:", err);
  }

  // Close WebSocket
  try {
    ws?.close();
    log.success("Cleanup", "WebSocket closed successfully.");
  } catch (err) {
    log.warn("Cleanup", "Error closing WebSocket:", err);
  }
}
