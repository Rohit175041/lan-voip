/**
 * Create a WebRTC peer connection.
 *
 * @param {WebSocket} socket          - Your signaling WebSocket.
 * @param {RefObject<HTMLVideoElement>} localVideo
 * @param {RefObject<HTMLVideoElement>} remoteVideo
 * @param {Function} onConnected      - Called when remote media is attached.
 */
export function createPeerConnection(socket, localVideo, remoteVideo, onConnected) {
  // ---- Build ICE server list ----
  const iceUrls =
    process.env.REACT_APP_ICE_SERVERS
      ? process.env.REACT_APP_ICE_SERVERS.split(",").map((u) => u.trim())
      : ["stun:stun.l.google.com:19302"];

  const configuration = {
    iceServers: [
      { urls: iceUrls },
      // 👉 ADD YOUR TURN SERVER HERE for production:
      // { urls: "turn:turn.yourdomain.com:3478", username: "user", credential: "pass" },
    ],
  };

  const pc = new RTCPeerConnection(configuration);

  // ---- ICE candidates ----
  pc.onicecandidate = (e) => {
    if (e.candidate && socket?.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({ ice: e.candidate }));
      } catch (err) {
        console.error("❌ Failed to send ICE candidate:", err);
      }
    }
  };

  // ---- ICE connection state logs ----
  pc.oniceconnectionstatechange = () => {
    console.log("🌐 ICE state:", pc.iceConnectionState);
    if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
      console.warn("⚠️ ICE failed or disconnected — likely need TURN");
    }
  };

  // ---- Remote track ----
  pc.ontrack = (e) => {
    if (remoteVideo?.current && e.streams[0]) {
      remoteVideo.current.srcObject = e.streams[0];
    }
    if (typeof onConnected === "function") onConnected();
  };

  return pc;
}

/**
 * Caller creates the DataChannel
 */
export function createChatChannel(pc, onMessage) {
  const dc = pc.createDataChannel("chat");
  dc.binaryType = "arraybuffer";

  dc.onopen = () => console.log("✅ DataChannel open");
  dc.onclose = () => console.log("⚠️ DataChannel closed");
  dc.onerror = (err) => console.error("⚠️ DataChannel error:", err);
  dc.onmessage = (e) => onMessage?.(e.data);

  return dc;
}

/**
 * Cleanup PeerConnection and WebSocket safely.
 */
export function cleanupPeerConnection(pc, ws, localVideo, remoteVideo) {
  if (localVideo?.current?.srcObject) {
    localVideo.current.srcObject.getTracks().forEach((t) => t.stop());
    localVideo.current.srcObject = null;
  }
  if (remoteVideo?.current) {
    remoteVideo.current.srcObject = null;
  }
  try { pc?.close(); } catch (err) { console.warn("⚠️ Peer close error:", err); }
  try { ws?.close(); } catch (err) { console.warn("⚠️ WS close error:", err); }
}
