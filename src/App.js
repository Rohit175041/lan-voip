import React, { useEffect, useRef, useState } from "react";

export default function App() {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  // --- Load ICE servers from .env ---
  const iceServers = [
    { urls: process.env.REACT_APP_ICE_SERVERS || "stun:stun.l.google.com:19302" }
  ];

  const [pc] = useState(() => new RTCPeerConnection({ iceServers }));
  const [ws, setWs] = useState(null);

  // ---- Get camera & microphone ----
  useEffect(() => {
    async function setupMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (localVideo.current) localVideo.current.srcObject = stream;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      } catch (err) {
        console.error("getUserMedia error:", err.name, err.message);
        alert(
          "Camera/Microphone permission denied or blocked. Please allow access and reload."
        );
      }
    }
    setupMedia();
  }, [pc]);

  // ---- WebSocket signalling ----
  useEffect(() => {
    const socketUrl =
      process.env.REACT_APP_SIGNALING_URL ||
      `${window.location.origin.replace(/^http/, "ws")}/ws`;

    const socket = new WebSocket(socketUrl);
    setWs(socket);

    socket.onopen = () => console.log("✅ WebSocket connected");
    socket.onerror = (e) => console.error("❌ WebSocket error:", e);
    socket.onclose = (e) => console.warn("⚠️ WebSocket closed:", e);

    socket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      console.log("⬅️ WS message:", data);

      try {
        if (data.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          console.log("✅ Set remote description:", data.sdp.type);

          if (data.sdp.type === "offer") {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            console.log("➡️ Sending answer");
            socket.send(JSON.stringify({ sdp: pc.localDescription }));
          }
        } else if (data.ice) {
          await pc.addIceCandidate(new RTCIceCandidate(data.ice));
          console.log("✅ Added ICE candidate");
        }
      } catch (err) {
        console.error("❌ Signalling error:", err);
      }
    };

    return () => socket.close();
  }, [pc]);

  // ---- ICE candidate + remote stream ----
  useEffect(() => {
    pc.onicecandidate = (e) => {
      if (e.candidate && ws?.readyState === WebSocket.OPEN) {
        console.log("➡️ Sending ICE candidate");
        ws.send(JSON.stringify({ ice: e.candidate }));
      }
    };

    pc.ontrack = (e) => {
      console.log("✅ Remote track received");
      if (remoteVideo.current && e.streams[0]) {
        remoteVideo.current.srcObject = e.streams[0];
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE state:", pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      console.log("PC state:", pc.connectionState);
    };
  }, [pc, ws]);

  // ---- Start a call ----
  const startCall = async () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      alert("WebSocket not connected");
      return;
    }
    try {
      console.log("📞 Creating offer");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log("➡️ Sending offer");
      ws.send(JSON.stringify({ sdp: pc.localDescription }));
    } catch (err) {
      console.error("❌ Start call error:", err);
    }
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
      <button
        onClick={startCall}
        style={{ marginTop: "1rem", padding: "0.5rem 1rem" }}
      >
        Start Call
      </button>
    </div>
  );
}
