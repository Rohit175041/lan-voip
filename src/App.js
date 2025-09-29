import React, { useRef, useState } from "react";

export default function App() {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  const [pc, setPc] = useState(null);
  const [ws, setWs] = useState(null);
  const [room, setRoom] = useState("");
  const [timeLeft, setTimeLeft] = useState(null); // countdown seconds
  const [timerId, setTimerId] = useState(null);

  // ---- Start Call ----
  const startCall = async () => {
    if (!room.trim()) {
      alert("⚠️ Please enter a Room ID before starting a call.");
      return;
    }
    if (pc || ws) {
      alert("⚠️ Already in a call. Disconnect first.");
      return;
    }

    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    const base =
      process.env.REACT_APP_SIGNALING_URL ||
      (isLocal
        ? `ws://${window.location.hostname}:8080/ws`
        : `wss://${window.location.hostname}/ws`);

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
          { urls: process.env.REACT_APP_ICE_SERVERS || "stun:stun.l.google.com:19302" },
        ],
      });
      setPc(peer);

      // Local media
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

      // ICE
      peer.onicecandidate = (e) => {
        if (e.candidate && socket.readyState === WebSocket.OPEN) {
          console.log("➡️ Sending ICE candidate");
          socket.send(JSON.stringify({ ice: e.candidate }));
        }
      };

      // Remote track
      peer.ontrack = (e) => {
        console.log("✅ Remote track received — other user joined");
        if (remoteVideo.current && e.streams[0]) {
          remoteVideo.current.srcObject = e.streams[0];
        }
        cancelTimer(); // stop countdown if remote joins
      };

      // Signaling
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
          } else if (data.type === "roomSize" && data.count >= 2) {
            console.log("👥 Another user joined. Stop timer.");
            cancelTimer();
          } else if (data.type === "timeout") {
            alert(data.message || "No one joined in time. Call ended.");
            cleanupPeer();
          }
        } catch (err) {
          console.error("❌ Signaling error:", err);
        }
      };

      // Offer
      console.log("📞 Creating offer...");
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.send(JSON.stringify({ sdp: peer.localDescription }));

      // 🔥 Start 2-min countdown
      startTimer(120);
    };
  };

  // ---- Countdown timer ----
  const startTimer = (seconds) => {
    setTimeLeft(seconds);
    const id = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === 1) {
          clearInterval(id);
          console.warn("⏳ No remote user joined within 2 minutes. Ending call.");
          alert("No one joined the call within 2 minutes. Call ended.");
          cleanupPeer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setTimerId(id);
  };

  const cancelTimer = () => {
    if (timerId) clearInterval(timerId);
    setTimerId(null);
    setTimeLeft(null);
  };

  // ---- Disconnect & Cleanup ----
  const cleanupPeer = () => {
    console.log("🛑 Cleaning up call...");
    cancelTimer();

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

      {/* Countdown */}
      {timeLeft !== null && (
        <div style={{ marginTop: "0.5rem", color: "orange", fontWeight: "bold" }}>
          Waiting for someone to join... Time left: {timeLeft}s
        </div>
      )}

      {/* Buttons */}
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
