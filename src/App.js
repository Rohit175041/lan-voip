import React, { useRef, useState } from "react";
import "./App.css";

import Header from "./components/Header";
import StatusIndicator from "./components/StatusIndicator";
import VideoGrid from "./components/VideoGrid";
import RoomInput from "./components/RoomInput";
import TimerProgress from "./components/TimerProgress";

import { createPeerConnection } from "./utils/webrtc";
import { createSocket } from "./utils/signaling";

export default function App() {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  const [pc, setPc] = useState(null);
  const [ws, setWs] = useState(null);
  const [room, setRoom] = useState("");
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);
  const [status, setStatus] = useState("disconnected");

  // ---------- TIMER ----------
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

  const startCall = async () => {
    if (!room.trim()) {
      alert("⚠️ Enter a Room ID first");
      return;
    }
    if (pc || ws) {
      alert("⚠️ Already in a call. Disconnect first.");
      return;
    }

    const socket = createSocket(room, cleanupPeer);
    setWs(socket);

    socket.onopen = async () => {
      setStatus("waiting");

      const peer = createPeerConnection(socket, remoteVideo, stopTimer, setStatus);
      setPc(peer);

      // ✅ now we can handle messages (peer exists)
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

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.send(JSON.stringify({ sdp: peer.localDescription }));

      startTimer(120);
    };
  };

  const disconnect = () => cleanupPeer();

  return (
    <div className="app">
      <Header />
      <StatusIndicator status={status} />
      <VideoGrid localVideo={localVideo} remoteVideo={remoteVideo} />
      <RoomInput room={room} setRoom={setRoom} />
      {timeLeft !== null && <TimerProgress timeLeft={timeLeft} />}
      <div className="buttons">
        <button onClick={startCall} disabled={pc || ws} className="start-btn">
          📞 Start Call
        </button>
        <button onClick={disconnect} className="disconnect-btn">
          ❌ Disconnect
        </button>
      </div>
    </div>
  );
}
