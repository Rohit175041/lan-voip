// // /**
// //  * Create a WebRTC peer connection.
// //  *
// //  * @param {WebSocket} socket          - Your signaling WebSocket.
// //  * @param {RefObject<HTMLVideoElement>} localVideo
// //  * @param {RefObject<HTMLVideoElement>} remoteVideo
// //  * @param {Function} onConnected      - Called when remote media is attached.
// //  */
// // export function createPeerConnection(socket, localVideo, remoteVideo, onConnected) {
// //   // ---- Build ICE server list ----
// //   const stunUrls =
// //     process.env.REACT_APP_ICE_SERVERS
// //       ? process.env.REACT_APP_ICE_SERVERS.split(",").map((u) => u.trim())
// //       : ["stun:stun.l.google.com:19302"];

// //   // Optional TURN credentials from env
// //   const turnUrl = process.env.REACT_APP_TURN_URL;
// //   const turnUser = process.env.REACT_APP_TURN_USERNAME;
// //   const turnPass = process.env.REACT_APP_TURN_PASSWORD;

// //   const iceServers = [{ urls: stunUrls }];
// //   if (turnUrl) {
// //     iceServers.push({
// //       urls: turnUrl,
// //       username: turnUser || undefined,
// //       credential: turnPass || undefined,
// //     });
// //   }

// //   const configuration = { iceServers };

// //   const pc = new RTCPeerConnection(configuration);

// //   console.log("📡 RTCPeerConnection created with ICE servers:", iceServers);

// //   // ---- ICE candidates ----
// //   pc.onicecandidate = (e) => {
// //     if (e.candidate && socket?.readyState === WebSocket.OPEN) {
// //       try {
// //         socket.send(JSON.stringify({ ice: e.candidate }));
// //         console.log("🧊 Sent ICE candidate:", e.candidate.candidate);
// //       } catch (err) {
// //         console.error("❌ Failed to send ICE candidate:", err);
// //       }
// //     }
// //   };

// //   // ---- ICE / Peer state logs ----
// //   pc.oniceconnectionstatechange = () =>
// //     console.log("🌐 ICE state:", pc.iceConnectionState);

// //   pc.onconnectionstatechange = () =>
// //     console.log("🔌 Peer state:", pc.connectionState);

// //   // ---- Remote track ----
// //   pc.ontrack = (e) => {
// //     console.log("🎥 Remote track received");
// //     if (remoteVideo?.current && e.streams[0]) {
// //       remoteVideo.current.srcObject = e.streams[0];
// //     }
// //     if (typeof onConnected === "function") onConnected();
// //   };

// //   return pc;
// // }

// // /**
// //  * Caller creates the DataChannel
// //  */
// // export function createChatChannel(pc, onMessage) {
// //   const dc = pc.createDataChannel("chat");
// //   dc.binaryType = "arraybuffer";

// //   dc.onopen = () => console.log("✅ DataChannel open");
// //   dc.onclose = () => console.log("⚠️ DataChannel closed");
// //   dc.onerror = (err) => console.error("⚠️ DataChannel error:", err);
// //   dc.onmessage = (e) => onMessage?.(e.data);

// //   return dc;
// // }

// // /**
// //  * Cleanup PeerConnection and WebSocket safely.
// //  */
// // export function cleanupPeerConnection(pc, ws, localVideo, remoteVideo) {
// //   // stop local media
// //   if (localVideo?.current?.srcObject) {
// //     localVideo.current.srcObject.getTracks().forEach((t) => t.stop());
// //     localVideo.current.srcObject = null;
// //   }

// //   // clear remote
// //   if (remoteVideo?.current) {
// //     remoteVideo.current.srcObject = null;
// //   }

// //   // close peer connection
// //   try {
// //     pc?.getSenders()?.forEach((s) => s.track?.stop());
// //     pc?.close();
// //   } catch (err) {
// //     console.warn("⚠️ Peer close error:", err);
// //   }

// //   // close websocket
// //   try {
// //     ws?.close();
// //   } catch (err) {
// //     console.warn("⚠️ WS close error:", err);
// //   }
// // }


// /**
//  * Create a WebRTC peer connection.
//  */
// export function createPeerConnection(socket, localVideo, remoteVideo, onConnected) {
//   // ---- Build ICE server list ----
//   const stunList = (process.env.REACT_APP_ICE_SERVERS || "")
//     .split(",")
//     .map((u) => u.trim())
//     .filter(Boolean)
//     .map((u) => ({ urls: u }));

//   const turnUrl = process.env.REACT_APP_TURN_SERVER;     // 🔥 match your .env key
//   const turnUser = process.env.REACT_APP_TURN_USERNAME;
//   const turnPass = process.env.REACT_APP_TURN_PASSWORD;

//   const iceServers = [...stunList];

//   if (turnUrl) {
//     iceServers.push({
//       urls: turnUrl,
//       username: turnUser || undefined,
//       credential: turnPass || undefined,
//     });
//   }

//   const pc = new RTCPeerConnection({ iceServers });

//   console.log("📡 RTCPeerConnection created with ICE servers:", iceServers);

//   // ---- ICE candidates ----
//   pc.onicecandidate = (e) => {
//     if (e.candidate && socket?.readyState === WebSocket.OPEN) {
//       try {
//         socket.send(JSON.stringify({ ice: e.candidate }));
//         console.log("🧊 Sent ICE:", e.candidate.candidate);
//       } catch (err) {
//         console.error("❌ Failed to send ICE candidate:", err);
//       }
//     }
//   };

//   // ---- ICE / Peer state logs ----
//   pc.oniceconnectionstatechange = () =>
//     console.log("🌐 ICE state:", pc.iceConnectionState);

//   pc.onconnectionstatechange = () =>
//     console.log("🔌 Peer state:", pc.connectionState);

//   // ---- Remote track ----
//   pc.ontrack = (e) => {
//     console.log("🎥 Remote track received");
//     if (remoteVideo?.current && e.streams[0]) {
//       remoteVideo.current.srcObject = e.streams[0];
//     }
//     onConnected?.();
//   };

//   return pc;
// }

// /**
//  * Caller creates the DataChannel
//  */
// export function createChatChannel(pc, onMessage) {
//   const dc = pc.createDataChannel("chat");
//   dc.binaryType = "arraybuffer";

//   dc.onopen = () => console.log("✅ DataChannel open");
//   dc.onclose = () => console.log("⚠️ DataChannel closed");
//   dc.onerror = (err) => console.error("⚠️ DataChannel error:", err);
//   dc.onmessage = (e) => onMessage?.(e.data);

//   return dc;
// }

// /**
//  * Cleanup PeerConnection and WebSocket safely.
//  */
// export function cleanupPeerConnection(pc, ws, localVideo, remoteVideo) {
//   if (localVideo?.current?.srcObject) {
//     localVideo.current.srcObject.getTracks().forEach((t) => t.stop());
//     localVideo.current.srcObject = null;
//   }

//   if (remoteVideo?.current) {
//     remoteVideo.current.srcObject = null;
//   }

//   try {
//     pc?.getSenders()?.forEach((s) => s.track?.stop());
//     pc?.close();
//   } catch (err) {
//     console.warn("⚠️ Peer close error:", err);
//   }

//   try {
//     ws?.close();
//   } catch (err) {
//     console.warn("⚠️ WS close error:", err);
//   }
// }


/**
 * Create a WebRTC peer connection using only STUN servers.
 *
 * @param {WebSocket} socket - signaling WebSocket
 * @param {RefObject<HTMLVideoElement>} localVideo
 * @param {RefObject<HTMLVideoElement>} remoteVideo
 * @param {Function} onConnected - called when remote media stream is attached
 */
export function createPeerConnection(socket, localVideo, remoteVideo, onConnected) {
  // Build ICE server list from env
  const iceUrls = (process.env.REACT_APP_ICE_SERVERS || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean)
    .map((u) => ({ urls: u }));

  const pc = new RTCPeerConnection({ iceServers: iceUrls });

  console.log("📡 RTCPeerConnection created with ICE servers:", iceUrls);

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
  pc.oniceconnectionstatechange = () =>
    console.log("🌐 ICE state:", pc.iceConnectionState);

  pc.onconnectionstatechange = () =>
    console.log("🔌 Peer state:", pc.connectionState);

  // ---- Remote track ----
  pc.ontrack = (e) => {
    console.log("🎥 Remote track received");
    if (remoteVideo?.current && e.streams[0]) {
      remoteVideo.current.srcObject = e.streams[0];
    }
    onConnected?.();
  };

  return pc;
}

/**
 * Caller creates the DataChannel for chat.
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
  try {
    pc?.getSenders()?.forEach((s) => s.track?.stop());
    pc?.close();
  } catch (err) {
    console.warn("⚠️ Peer close error:", err);
  }
  try {
    ws?.close();
  } catch (err) {
    console.warn("⚠️ WS close error:", err);
  }
}
