import React, {useRef, useState } from "react";

export default function App() {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  const [pc, setPc] = useState(null);
  const [ws, setWs] = useState(null);

  // ---- Setup WebSocket ----
  const initWebSocket = () => {
    const socket = new WebSocket(
      process.env.REACT_APP_SIGNALING_URL ||
        `${window.location.origin.replace(/^http/, "ws")}/ws`
    );
    setWs(socket);
    socket.onopen = () => console.log("✅ WebSocket connected");
    socket.onerror = (e) => console.error("❌ WebSocket error:", e);
    socket.onclose = () => console.warn("⚠️ WebSocket closed");
    return socket;
  };

  // ---- Create PeerConnection + Media ----
  const initPeer = async (socket) => {
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: process.env.REACT_APP_ICE_SERVERS || "stun:stun.l.google.com:19302" },
      ],
    });

    // Local camera/mic
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (localVideo.current) localVideo.current.srcObject = stream;
    stream.getTracks().forEach((t) => peer.addTrack(t, stream));

    // ICE candidates → send to server
    peer.onicecandidate = (e) => {
      if (e.candidate && socket?.readyState === WebSocket.OPEN) {
        console.log("➡️ Sending ICE candidate");
        socket.send(JSON.stringify({ ice: e.candidate }));
      }
    };

    // Remote track
    peer.ontrack = (e) => {
      console.log("✅ Remote track received");
      if (remoteVideo.current && e.streams[0]) {
        remoteVideo.current.srcObject = e.streams[0];
      }
    };

    // Listen for signalling
    socket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      console.log("⬅️ WS:", data);
      if (data.sdp) {
        await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
        if (data.sdp.type === "offer") {
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socket.send(JSON.stringify({ sdp: peer.localDescription }));
        }
      } else if (data.ice) {
        await peer.addIceCandidate(new RTCIceCandidate(data.ice));
      }
    };

    setPc(peer);
    return peer;
  };

  // ---- Start Call ----
  const startCall = async () => {
    if (pc || ws) {
      console.warn("Already in a call, please disconnect first.");
      return;
    }
    const socket = initWebSocket();
    socket.onopen = async () => {
      console.log("📞 Starting call...");
      const peer = await initPeer(socket);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.send(JSON.stringify({ sdp: peer.localDescription }));
    };
  };

  // ---- Disconnect ----
  const disconnect = () => {
    console.log("🛑 Disconnecting...");

    // Stop local tracks
    if (localVideo.current?.srcObject) {
      localVideo.current.srcObject.getTracks().forEach((t) => t.stop());
      localVideo.current.srcObject = null;
    }
    if (remoteVideo.current) remoteVideo.current.srcObject = null;

    // Close peer connection
    if (pc) {
      pc.getSenders().forEach((s) => s.track && s.track.stop());
      pc.close();
    }

    // Close websocket
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }

    setPc(null);
    setWs(null);
  };

  return (
    <div style={{ textAlign: "center", padding: "1rem" }}>
      <h2>Video Call (WebRTC)</h2>
      <div style={{ display: "flex", justifyContent: "center", gap: "1rem" }}>
        <video ref={localVideo} autoPlay muted playsInline style={{ width: "45%", background: "#000" }} />
        <video ref={remoteVideo} autoPlay playsInline style={{ width: "45%", background: "#000" }} />
      </div>
      <div style={{ marginTop: "1rem" }}>
        <button
          onClick={startCall}
          style={{ marginRight: "1rem", padding: "0.5rem 1rem" }}
        >
          Start Call
        </button>
        <button
          onClick={disconnect}
          style={{
            padding: "0.5rem 1rem",
            background: "red",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
