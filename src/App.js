import React, { useRef, useState } from "react";

export default function App() {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  const [pc, setPc] = useState(null);
  const [ws, setWs] = useState(null);
  const [room, setRoom] = useState("");

  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null); // ✅ holds active interval id

  const startTimer = (seconds) => {
    stopTimer(); // clear any old timer first
    setTimeLeft(seconds);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopTimer();
          alert("No one joined the call within 2 minutes. Call ended.");
          cleanupPeer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimeLeft(null);
  };

  const cleanupPeer = () => {
    console.log("🛑 Cleaning up call...");
    stopTimer();

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

  const startCall = async () => {
    if (!room.trim()) {
      alert("Enter a Room ID first");
      return;
    }
    if (pc || ws) {
      alert("Already in a call. Disconnect first.");
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
    console.log("Connecting to:", socketUrl);

    const socket = new WebSocket(socketUrl);
    setWs(socket);

    socket.onclose = () => {
      console.warn("⚠️ WebSocket closed");
      cleanupPeer();
    };

    socket.onopen = async () => {
      console.log(`✅ Connected to signaling server, room: ${room}`);

      const peer = new RTCPeerConnection({
        iceServers: [{ urls: process.env.REACT_APP_ICE_SERVERS || "stun:stun.l.google.com:19302" }],
      });
      setPc(peer);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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
        stopTimer(); // stop countdown once other user joins
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
          if (data.count >= 2) stopTimer();
          else if (data.count === 1) startTimer(120);
        }
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.send(JSON.stringify({ sdp: peer.localDescription }));

      startTimer(120); // start countdown when we join alone
    };
  };

  const disconnect = () => {
    console.log("🛑 Disconnect clicked");
    cleanupPeer();
  };

  return (
    <div style={{ textAlign: "center", padding: "1rem" }}>
      <h2>Video Call (WebRTC)</h2>

      <div style={{ display: "flex", justifyContent: "center", gap: "1rem" }}>
        <video ref={localVideo} autoPlay muted playsInline style={{ width: "45%", background: "#000" }} />
        <video ref={remoteVideo} autoPlay playsInline style={{ width: "45%", background: "#000" }} />
      </div>

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

      {timeLeft !== null && (
        <div style={{ marginTop: "0.5rem", color: "orange", fontWeight: "bold" }}>
          Waiting for someone to join... Time left: {timeLeft}s
        </div>
      )}

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
