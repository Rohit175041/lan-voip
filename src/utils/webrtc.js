/**
 * Create a WebRTC peer connection.
 *
 * @param {WebSocket} socket          - Your signaling WebSocket.
 * @param {RefObject<HTMLVideoElement>} localVideo
 * @param {RefObject<HTMLVideoElement>} remoteVideo
 * @param {Function} onConnected      - Called when remote media is attached.
 */
export function createPeerConnection(
  socket,
  localVideo,
  remoteVideo,
  onConnected
) {
  const peer = new RTCPeerConnection({
    iceServers: [
      {
        urls:
          process.env.REACT_APP_ICE_SERVERS || "stun:stun.l.google.com:19302",
      },
    ],
  });

  // ---- ICE candidates ----
  peer.onicecandidate = (e) => {
    if (e.candidate && socket?.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({ ice: e.candidate }));
      } catch (err) {
        console.error("❌ Failed to send ICE candidate:", err);
      }
    }
  };

  // ---- Remote track ----
  peer.ontrack = (e) => {
    if (remoteVideo?.current && e.streams[0]) {
      remoteVideo.current.srcObject = e.streams[0];
    }
    if (typeof onConnected === "function") onConnected();
  };

  // ✅ Removed duplicate `peer.ondatachannel` handler.
  // DataChannel will now only be handled in App.js

  return peer;
}

/**
 * Caller creates the DataChannel
 *
 * @param {RTCPeerConnection} peer
 * @param {Function} onMessage - Called when data is received (string | ArrayBuffer).
 */
export function createChatChannel(peer, onMessage) {
  const dc = peer.createDataChannel("chat");
  dc.binaryType = "arraybuffer";

  dc.onopen = () => console.log("✅ DataChannel open (caller)");
  dc.onclose = () => console.log("⚠️ DataChannel closed (caller)");
  dc.onerror = (err) => console.error("⚠️ DataChannel error:", err);

  dc.onmessage = (e) => {
    if (typeof onMessage === "function") onMessage(e.data);
  };

  return dc;
}

/**
 * Cleanup PeerConnection and WebSocket safely.
 */
export function cleanupPeerConnection(pc, ws, localVideo, remoteVideo) {
  // Stop local video/audio
  if (localVideo?.current?.srcObject) {
    localVideo.current.srcObject.getTracks().forEach((t) => t.stop());
    localVideo.current.srcObject = null;
  }

  // Clear remote stream
  if (remoteVideo?.current) {
    remoteVideo.current.srcObject = null;
  }

  // Close PeerConnection
  if (pc) {
    try {
      pc.getSenders().forEach((s) => s.track && s.track.stop());
    } catch (err) {
      console.warn("⚠️ Error stopping tracks:", err);
    }
    try {
      pc.close();
    } catch (err) {
      console.warn("⚠️ PeerConnection close error:", err);
    }
  }

  // Close WebSocket
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.close();
    } catch (err) {
      console.warn("⚠️ WebSocket close error:", err);
    }
  }
}
