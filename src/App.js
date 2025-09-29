import React, { useRef, useState } from "react";

export default function App() {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  const [pc, setPc] = useState(null);
  const [ws, setWs] = useState(null);
  const [room, setRoom] = useState("");
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);
  const [status, setStatus] = useState("disconnected"); // disconnected | waiting | connected

  // ---------------- TIMER ----------------
  const startTimer = (seconds) => {
    stopTimer();
    setTimeLeft(seconds);
    setStatus("waiting");
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopTimer();
          alert("No one joined within 2 minutes. Call ended.");
          cleanupPeer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setTimeLeft(null);
  };

  // ---------------- CLEANUP ----------------
  const cleanupPeer = () => {
    stopTimer();
    setStatus("disconnected");

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

  // ---------------- START CALL ----------------
  const startCall = async () => {
    if (!room.trim()) {
      alert("⚠️ Enter a Room ID first");
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

    const socket = new WebSocket(socketUrl);
    setWs(socket);

    socket.onerror = (err) => console.error("❌ WebSocket error:", err);
    socket.onclose = () => cleanupPeer();

    socket.onopen = async () => {
      setStatus("waiting");

      const peer = new RTCPeerConnection({
        iceServers: [
          { urls: process.env.REACT_APP_ICE_SERVERS || "stun:stun.l.google.com:19302" },
        ],
      });
      setPc(peer);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (localVideo.current) localVideo.current.srcObject = stream;
        stream.getTracks().forEach((t) => peer.addTrack(t, stream));
      } catch (err) {
        alert("Camera/Microphone permission denied");
        socket.close();
        return;
      }

      peer.onicecandidate = (e) => {
        if (e.candidate && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ ice: e.candidate }));
        }
      };

      peer.ontrack = (e) => {
        if (remoteVideo.current && e.streams[0]) {
          remoteVideo.current.srcObject = e.streams[0];
        }
        stopTimer();
        setStatus("connected");
      };

      socket.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        if (data.sdp) {
          await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
          if (data.sdp.type === "offer") {
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            socket.send(JSON.stringify({ sdp: peer.localDescription }));
          }
        } else if (data.ice) {
          await peer.addIceCandidate(new RTCIceCandidate(data.ice));
        } else if (data.type === "roomSize") {
          if (data.count >= 2) {
            stopTimer();
            setStatus("connected");
          } else if (data.count === 1) {
            startTimer(120);
            setStatus("waiting");
          }
        } else if (data.type === "timeout") {
          alert(data.message || "Call ended due to inactivity.");
          cleanupPeer();
        }
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.send(JSON.stringify({ sdp: peer.localDescription }));

      startTimer(120);
    };
  };

  const disconnect = () => cleanupPeer();

  // ---------------- UI ----------------
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundImage:
          "linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.6)), url('https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?auto=format&fit=crop&w=1500&q=80')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "2rem",
        fontFamily: "Poppins, sans-serif",
        color: "#fff",
      }}
    >
      {/* HEADER */}
      <div style={{ textAlign: "center", marginBottom: "1rem" }}>
        <img
          src="https://img.icons8.com/color/96/video-call.png"
          alt="logo"
          style={{ height: "60px" }}
        />
        <h1 style={{ margin: "0.5rem 0", fontSize: "2rem" }}>WaveRTC</h1>
        <p style={{ margin: 0, fontSize: "1rem", color: "#ddd" }}>
          Peer-to-peer video chat
        </p>
      </div>

      {/* STATUS */}
      <div style={{ marginBottom: "1rem", fontSize: "1.1rem" }}>
        {status === "connected" && <span style={{ color: "#4caf50" }}>🟢 Connected</span>}
        {status === "waiting" && <span style={{ color: "#ffeb3b" }}>⏳ Waiting...</span>}
        {status === "disconnected" && <span style={{ color: "#f44336" }}>🔴 Disconnected</span>}
      </div>

      {/* VIDEO SECTION */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
        {[{ ref: localVideo, label: "You" }, { ref: remoteVideo, label: "Remote" }].map(
          (v, i) => (
            <div
              key={i}
              style={{
                background: "rgba(0,0,0,0.6)",
                borderRadius: "15px",
                overflow: "hidden",
                width: "300px",
                height: "200px",
                boxShadow: "0 8px 25px rgba(0,0,0,0.4)",
                position: "relative",
              }}
            >
              <video
                ref={v.ref}
                autoPlay
                muted={v.label === "You"}
                playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: "8px",
                  right: "8px",
                  background: "rgba(0,0,0,0.5)",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  fontSize: "0.8rem",
                }}
              >
                {v.label}
              </div>
            </div>
          )
        )}
      </div>

      {/* ROOM INPUT */}
      <div style={{ display: "flex", alignItems: "center", marginTop: "1rem" }}>
        <input
          type="text"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="Enter Room ID"
          style={{
            padding: "0.6rem 1rem",
            fontSize: "1rem",
            textAlign: "center",
            borderRadius: "25px",
            border: "none",
            width: "250px",
            marginRight: "8px",
          }}
        />
        {room && (
          <button
            onClick={() => navigator.clipboard.writeText(room)}
            title="Copy Room ID"
            style={{
              background: "#2196f3",
              border: "none",
              borderRadius: "50%",
              color: "white",
              width: "40px",
              height: "40px",
              cursor: "pointer",
              boxShadow: "0 3px 8px rgba(0,0,0,0.2)",
            }}
          >
            📋
          </button>
        )}
      </div>

      {/* TIMER PROGRESS */}
      {timeLeft !== null && (
        <div style={{ marginTop: "0.5rem", textAlign: "center", width: "250px" }}>
          <div
            style={{
              height: "8px",
              background: "#eee",
              borderRadius: "5px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "8px",
                width: `${(timeLeft / 120) * 100}%`,
                background: "#ff9800",
                transition: "width 1s linear",
              }}
            />
          </div>
          <div style={{ marginTop: "5px", fontSize: "0.9rem", color: "#fff" }}>
            Waiting... {timeLeft}s
          </div>
        </div>
      )}

      {/* BUTTONS */}
      <div style={{ marginTop: "1rem" }}>
        <button
          onClick={startCall}
          disabled={pc || ws}
          title="Start a new call"
          style={{
            marginRight: "1rem",
            padding: "0.7rem 1.5rem",
            fontSize: "1rem",
            border: "none",
            borderRadius: "25px",
            background: pc || ws ? "#9e9e9e" : "#4caf50",
            color: "white",
            cursor: pc || ws ? "not-allowed" : "pointer",
            boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
          }}
        >
          📞 Start Call
        </button>

        <button
          onClick={disconnect}
          title="Disconnect call"
          style={{
            padding: "0.7rem 1.5rem",
            fontSize: "1rem",
            border: "none",
            borderRadius: "25px",
            background: "#f44336",
            color: "white",
            cursor: "pointer",
            boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
          }}
        >
          ❌ Disconnect
        </button>
      </div>
    </div>
  );
}
