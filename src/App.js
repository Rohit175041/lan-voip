import React, { useEffect, useRef, useState } from "react";

export default function App() {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  const [pc, setPc] = useState(null);
  const [ws, setWs] = useState(null);

  const setupConnection = async () => {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: process.env.REACT_APP_ICE_SERVERS || "stun:stun.l.google.com:19302" }],
    });
    setPc(peer);

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (localVideo.current) localVideo.current.srcObject = stream;
    stream.getTracks().forEach((t) => peer.addTrack(t, stream));

    peer.onicecandidate = (e) => {
      if (e.candidate && ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ ice: e.candidate }));
      }
    };
    peer.ontrack = (e) => {
      if (remoteVideo.current && e.streams[0]) {
        remoteVideo.current.srcObject = e.streams[0];
      }
    };

    return peer;
  };

  // ---- WebSocket signalling ----
  useEffect(() => {
    const socket = new WebSocket(
      process.env.REACT_APP_SIGNALING_URL ||
        `${window.location.origin.replace(/^http/, "ws")}/ws`
    );
    setWs(socket);

    socket.onopen = () => console.log("✅ WebSocket connected");
    socket.onerror = (e) => console.error("❌ WebSocket error:", e);
    socket.onclose = (e) => console.warn("⚠️ WebSocket closed:", e);

    return () => socket.close();
  }, []);

  // ---- Start a call ----
  const startCall = async () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      alert("WebSocket not connected");
      return;
    }
    const peer = await setupConnection();
    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.sdp) {
        await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
        if (data.sdp.type === "offer") {
          const ans = await peer.createAnswer();
          await peer.setLocalDescription(ans);
          ws.send(JSON.stringify({ sdp: peer.localDescription }));
        }
      } else if (data.ice) {
        await peer.addIceCandidate(new RTCIceCandidate(data.ice));
      }
    };

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    ws.send(JSON.stringify({ sdp: peer.localDescription }));
  };

  // ---- Disconnect ----
  const disconnect = () => {
    console.log("🛑 Disconnecting");
    pc?.getSenders().forEach((s) => s.track && s.track.stop());
    pc?.close();
    ws?.close();
    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
  };

  return (
    <div style={{ textAlign: "center", padding: "1rem" }}>
      <h2>Video Call (WebRTC)</h2>
      <div style={{ display: "flex", justifyContent: "center", gap: "1rem" }}>
        <video ref={localVideo} autoPlay muted playsInline style={{ width: "45%", background: "#000" }} />
        <video ref={remoteVideo} autoPlay playsInline style={{ width: "45%", background: "#000" }} />
      </div>
      <div style={{ marginTop: "1rem" }}>
        <button onClick={startCall} style={{ marginRight: "1rem", padding: "0.5rem 1rem" }}>
          Start Call
        </button>
        <button
          onClick={disconnect}
          style={{ padding: "0.5rem 1rem", background: "red", color: "white", border: "none" }}
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
