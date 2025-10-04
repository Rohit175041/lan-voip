/**
 * Create a WebRTC peer connection.
 *
 * @param {WebSocket} socket          - Signaling WebSocket.
 * @param {RefObject<HTMLVideoElement>} localVideo
 * @param {RefObject<HTMLVideoElement>} remoteVideo
 * @param {Function} onConnected      - Called when remote media is attached.
 */
export function createPeerConnection(socket, localVideo, remoteVideo, onConnected) {
  console.log("⚡ [WebRTC] Creating PeerConnection...");

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

  console.log("🌍 [WebRTC] ICE servers used:", iceServers);

  const pc = new RTCPeerConnection({ iceServers });

  // ---- ICE candidate generation ----
  pc.onicecandidate = (e) => {
    if (e.candidate) {
      console.log("🧊 [ICE] Local candidate found:", e.candidate.candidate);
      if (socket?.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify({ ice: e.candidate }));
          console.log("📤 [Signaling] Sent ICE candidate");
        } catch (err) {
          console.error("❌ [Signaling] Failed to send ICE candidate:", err);
        }
      } else {
        console.warn("⚠️ [Signaling] Cannot send ICE, socket not open.");
      }
    } else {
      console.log("🧊 [ICE] Candidate gathering finished.");
    }
  };

  // ---- ICE connection state changes ----
  pc.oniceconnectionstatechange = () => {
    console.log("🌐 [ICE] Connection state:", pc.iceConnectionState);
    if (pc.iceConnectionState === "failed") {
      console.warn("⚠️ [ICE] Connection failed — TURN server might be required.");
    }
    if (pc.iceConnectionState === "disconnected") {
      console.warn("⚠️ [ICE] Disconnected — network might be unstable.");
    }
  };

  // ---- Peer overall connection state ----
  pc.onconnectionstatechange = () => {
    console.log("🔌 [Peer] Connection state:", pc.connectionState);
  };

  // ---- Remote track (video/audio) ----
  pc.ontrack = (e) => {
    console.log("🎥 [Peer] Remote track received:", e.streams?.length, "stream(s)");
    if (remoteVideo?.current && e.streams[0]) {
      remoteVideo.current.srcObject = e.streams[0];
      console.log("✅ [Peer] Remote video stream attached.");
    }
    onConnected?.();
  };

  return pc;
}

/**
 * Caller creates the DataChannel for chat & file transfer.
 */
export function createChatChannel(pc, onMessage) {
  console.log("💬 [DataChannel] Creating outbound DataChannel...");
  const dc = pc.createDataChannel("chat");
  dc.binaryType = "arraybuffer";

  dc.onopen = () => console.log("✅ [DataChannel] Open (caller)");
  dc.onclose = () => console.warn("⚠️ [DataChannel] Closed");
  dc.onerror = (err) => console.error("❌ [DataChannel] Error:", err);
  dc.onmessage = (e) => {
    console.log("📩 [DataChannel] Message received:", e.data instanceof ArrayBuffer ? "ArrayBuffer" : e.data);
    onMessage?.(e.data);
  };

  return dc;
}

/**
 * Cleanup PeerConnection and WebSocket safely.
 */
export function cleanupPeerConnection(pc, ws, localVideo, remoteVideo) {
  console.log("🧹 [Cleanup] Closing PeerConnection and WebSocket...");

  // Stop local tracks
  if (localVideo?.current?.srcObject) {
    console.log("🧹 [Cleanup] Stopping local media tracks.");
    localVideo.current.srcObject.getTracks().forEach((t) => t.stop());
    localVideo.current.srcObject = null;
  }

  // Clear remote video
  if (remoteVideo?.current) {
    console.log("🧹 [Cleanup] Clearing remote video element.");
    remoteVideo.current.srcObject = null;
  }

  // Close peer connection
  try {
    pc?.getSenders()?.forEach((s) => s.track?.stop());
    pc?.close();
    console.log("✅ [Cleanup] PeerConnection closed.");
  } catch (err) {
    console.warn("⚠️ [Cleanup] Error closing PeerConnection:", err);
  }

  // Close WebSocket
  try {
    ws?.close();
    console.log("✅ [Cleanup] WebSocket closed.");
  } catch (err) {
    console.warn("⚠️ [Cleanup] Error closing WebSocket:", err);
  }
}
