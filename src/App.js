import React, { useRef, useState } from "react";

export default function App() {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  const [pc, setPc] = useState(null);
  const [ws, setWs] = useState(null);
  const [room, setRoom] = useState(""); // user must enter

  // ---- Start Call ----
  const startCall = async () => {
    if (!room.trim()) {
      alert("⚠️ Please enter a Room ID before starting a call.");
      return;
    }
    if (pc || ws) {
      alert("⚠️ You are already in a call. Disconnect first.");
      return;
    }

    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    // ---- Build signalling URL ----
    const base =
      process.env.REACT_APP_SIGNALING_URL ||
      (isLocal
        ? `ws://${window.location.hostname}:8080/ws` // local dev
        : `wss://${window.location.hostname}/ws`); // production
    const socketUrl = `${base}?room=${encodeURIComponent(room)}`;
    console.log("🔌 Connecting to signaling server:", socketUrl);

    const socket = new WebSocket(socketUrl);
    setWs(socket);

    socket.onerror = (e) => console.error("❌ WebSocket error:", e);
    socket.onclose = () => {
      console.warn("⚠️ WebSocket closed");
      cleanupPeer();
    };

    socket.onopen = async () => {
      console.log(`✅ Connected to signaling server. Joined room: ${room}`);

      const peer = new RTCPeerConnection({
        iceServers: [
          {
            urls:
              process.env.REACT_APP_ICE_SERVERS ||
              "stun:stun.l.google.com:19302",
          },
        ],
      });
      setPc(peer);

      // --- Get local camera & mic ---
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (localVideo.current) localVideo.current.srcObject = stream;
        stream.getTracks().forEach((t) => peer.addTrack(t, stream));
        console.log("🎥 Local media stream added");
      } catch (err) {
        console.error("getUserMedia error:", err.name, err.message);
        alert("Camera/Microphone permission denied or blocked.");
        socket.close();
        return;
      }

      // --- ICE candidates ---
      peer.onicecandidate = (e) => {
        if (e.candidate && socket.readyState === WebSocket.OPEN) {
          console.log("➡️ Sending ICE candidate");
          socket.send(JSON.stringify({ ice: e.candidate }));
        }
      };

      // --- Remote stream ---
      peer.ontrack = (e) => {
        console.log("✅ Remote track received");
        if (remoteVideo.current && e.streams[0]) {
          remoteVideo.current.srcObject = e.streams[0];
        }
      };

      // --- Handle messages from signaling server ---
      socket.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log("⬅️ WS message:", data);
        try {
          if (data.sdp) {
            await peer.setRemoteDescription(
              new RTCSessionDescription(data.sdp)
            );
            console.log(`✅ Set remote description: ${data.sdp.type}`);

            if (data.sdp.type === "offer") {
              const answer = await peer.createAnswer();
              await peer.setLocalDescription(answer);
              console.log("➡️ Sending answer");
              socket.send(JSON.stringify({ sdp: peer.localDescription }));
            }
          } else if (data.ice) {
            await peer.addIceCandidate(new RTCIceCandidate(data.ice));
            console.log("✅ Added ICE candidate");
          }
        } catch (err) {
          console.error("❌ Signaling error:", err);
        }
      };

      // --- Create & send our offer ---
      console.log("📞 Creating offer...");
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      console.log("➡️ Sending offer");
      socket.send(JSON.stringify({ sdp: peer.localDescription }));
    };
  };

  // ---- Disconnect & Cleanup ----
  const cleanupPeer = () => {
    console.log("🛑 Cleaning up peer & media...");
    if (localVideo.current?.srcObject) {
      localVideo.current.srcObject.getTracks().forEach((t) => t.stop());
      localVideo.current.srcObject = null;
    }
    if (remoteVideo.current) remoteVideo.current.srcObject = null;

    pc?.getSenders().forEach((s) => s.track && s.track.stop());
    pc?.close();
    setPc(null);

    if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    setWs(null);
  };

  const disconnect = () => {
    console.log("🛑 Disconnect button clicked");
    cleanupPeer();
  };

  return (
    <div style={{ textAlign: "center", padding: "1rem" }}>
      <h2>Video Call (WebRTC)</h2>

      <div style={{ display: "flex", justifyContent: "center", gap: "1rem" }}>
        <video
          ref={localVideo}
          autoPlay
          muted
          playsInline
          style={{ width: "45%", background: "#000" }}
        />
        <video
          ref={remoteVideo}
          autoPlay
          playsInline
          style={{ width: "45%", background: "#000" }}
        />
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

      {/* Buttons */}
      <div style={{ marginTop: "0.5rem" }}>
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
