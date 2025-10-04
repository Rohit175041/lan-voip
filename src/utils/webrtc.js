/**
 * Create a WebRTC peer connection.
 *
 * @param {WebSocket} socket          - Signaling WebSocket.
 * @param {RefObject<HTMLVideoElement>} localVideo
 * @param {RefObject<HTMLVideoElement>} remoteVideo
 * @param {Function} onConnected      - Called when remote media is attached.
 */
export function createPeerConnection(socket, localVideo, remoteVideo, onConnected) {
  // --- Build ICE server list from .env ---
  const stunUrls = (process.env.REACT_APP_ICE_SERVERS || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean)
    .map((u) => ({ urls: u }));

  // Optional TURN server (if provided in .env)
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

  const pc = new RTCPeerConnection({ iceServers });

  console.log("📡 RTCPeerConnection created with ICE servers:", iceServers);

  // ---- ICE candidates ----
  pc.onicecandidate = (e) => {
    if (e.candidate && socket?.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({ ice: e.candidate }));
        console.log("🧊 Sent ICE candidate:", e.candidate.candidate);
      } catch (err) {
        console.error("❌ Failed to send ICE candidate:", err);
      }
    }
  };

  // ---- ICE / Peer state logs ----
  pc.oniceconnectionstatechange = () => {
    console.log("🌐 ICE state:", pc.iceConnectionState);
    if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
      console.warn("⚠️ ICE failed/disconnected — TURN server might be required.");
    }
  };

  pc.onconnectionstatechange = () => {
    console.log("🔌 Peer connection state:", pc.connectionState);
  };

  // ---- Remote track ----
  pc.ontrack = (e) => {
    console.log("🎥 Remote track received");
    if (remoteVideo?.current && e.streams[0]) {
      remoteVideo.current.srcObject = e.streams[0];
    }
    if (onConnected) onConnected();
  };

  return pc;
}

/**
 * Caller creates the DataChannel for chat & file transfer.
 */
export function createChatChannel(pc, onMessage) {
  const dc = pc.createDataChannel("chat");
  dc.binaryType = "arraybuffer";

  dc.onopen = () => console.log("✅ DataChannel open");
  dc.onclose = () => console.warn("⚠️ DataChannel closed");
  dc.onerror = (err) => console.error("⚠️ DataChannel error:", err);
  dc.onmessage = (e) => onMessage?.(e.data);

  return dc;
}

/**
 * Cleanup PeerConnection and WebSocket safely.
 */
export function cleanupPeerConnection(pc, ws, localVideo, remoteVideo) {
  // Stop local video tracks
  if (localVideo?.current?.srcObject) {
    localVideo.current.srcObject.getTracks().forEach((t) => t.stop());
    localVideo.current.srcObject = null;
  }

  // Clear remote video
  if (remoteVideo?.current) {
    remoteVideo.current.srcObject = null;
  }

  // Close peer connection
  try {
    pc?.getSenders()?.forEach((s) => s.track?.stop());
    pc?.close();
  } catch (err) {
    console.warn("⚠️ Error closing PeerConnection:", err);
  }

  // Close websocket
  try {
    ws?.close();
  } catch (err) {
    console.warn("⚠️ Error closing WebSocket:", err);
  }
}
