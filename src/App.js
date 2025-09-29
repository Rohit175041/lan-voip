import React, { useRef, useState } from "react";

export default function App() {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  const [pc, setPc] = useState(null);
  const [ws, setWs] = useState(null);
  const [room, setRoom] = useState(""); // no default

  // --- Start Call ---
  const startCall = async () => {
    if (!room.trim()) {
      alert("Please enter a Room ID before starting a call.");
      return;
    }
    if (pc || ws) {
      console.warn("Already in a call. Disconnect first.");
      return;
    }

    // --- Build signalling URL ---
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const base =
      process.env.REACT_APP_SIGNALING_URL ||
      (isLocalhost
        ? `ws://${window.location.hostname}:8080` // local dev
        : `wss://${window.location.hostname}`);    // production
    const socketUrl = `${base}/ws?room=${encodeURIComponent(room)}`;

    console.log("Connecting to:", socketUrl);
    const socket = new WebSocket(socketUrl);
    setWs(socket);

    socket.onerror = (e) => console.error("WebSocket error:", e);
    socket.onclose = () => console.warn("WebSocket closed");

    socket.onopen = async () => {
      console.log(`✅ Connected to room: ${room}`);

      const peer = new RTCPeerConnection({
        iceServers: [
          { urls: process.env.REACT_APP_ICE_SERVERS || "stun:stun.l.google.com:19302" },
        ],
      });
      setPc(peer);

      // Local media
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (localVideo.current) localVideo.current.srcObject = stream;
        stream.getTracks().forEach((t) => peer.addTrack(t, stream));
      } catch (err) {
        console.error("getUserMedia error:", err.name, err.message);
        alert("Camera/Microphone permission denied or blocked.");
        return;
      }

      // ICE candidates
      peer.onicecandidate = (e) => {
        if (e.candidate && socket.readyState === WebSocket.OPEN) {
          console.log("➡️ Sending ICE candidate");
          socket.send(JSON.stringify({ ice: e.candidate }));
        }
      };

      // Remote stream
      peer.ontrack = (e) => {
        console.log("✅ Remote track received");
        if (remoteVideo.current && e.streams[0]) {
          remoteVideo.current.srcObject = e.streams[0];
        }
      };

      // Signaling messages
      socket.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log("⬅️ WS:", data);
        try {
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
        } catch (err) {
          console.error("❌ Signaling error:", err);
        }
      };

      // Create & send our offer
      console.log("📞 Creating offer");
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.send(JSON.stringify({ sdp: peer.localDescription }));
    };
  };

  // --- Disconnect ---
  const disconnect = () => {
    console.log("🛑 Disconnecting...");

    if (localVideo.current?.srcObject) {
      localVideo.current.srcObject.getTracks().forEach((t) => t.stop());
      localVideo.current.srcObject = null;
    }
    if (remoteVideo.current) remoteVideo.current.srcObject = null;

    pc?.close();
    if (ws && ws.readyState === WebSocket.OPEN) ws.close();

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

      {/* Room ID input */}
      <div style={{ marginTop: "1rem" }}>
        <input
          type="text"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="Enter Room ID"
          style={{
            padding: "0.5rem",
            fontSize: "1rem",
            marginBottom: "1rem",
            textAlign: "center",
            width: "200px",
          }}
        />
      </div>

      {/* Call buttons */}
      <div style={{ marginTop: "0.5rem" }}>
        <button onClick={startCall} style={{ marginRight: "1rem", padding: "0.5rem 1rem" }}>
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
