import React, { useRef, useState } from "react";
import "./App.css";

import Header from "./components/Header";
import StatusIndicator from "./components/StatusIndicator";
import VideoGrid from "./components/VideoGrid";
import RoomInput from "./components/RoomInput";
import TimerProgress from "./components/TimerProgress";

import { createPeerConnection, cleanupPeerConnection } from "./utils/webrtc";
import { createWebSocket } from "./utils/signaling";

export default function App() {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  const [pc, setPc] = useState(null);
  const [ws, setWs] = useState(null);
  const [room, setRoom] = useState("");
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);
  const [status, setStatus] = useState("disconnected"); // disconnected | waiting | connected

  // -------- TIMER --------
  const startTimer = (seconds) => {
    stopTimer();
    setTimeLeft(seconds);
    setStatus("waiting");
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopTimer();
          alert("No one joined within 2 minutes. Call ended.");
          disconnect();
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

  // -------- CLEANUP --------
  const disconnect = () => {
    stopTimer();
    setStatus("disconnected");
    cleanupPeerConnection(pc, ws, localVideo, remoteVideo);
    setPc(null);
    setWs(null);
  };

  // -------- START CALL --------
  const startCall = async () => {
    if (!room.trim()) {
      alert("⚠️ Enter a Room ID first");
      return;
    }
    if (pc || ws) {
      alert("⚠️ Already in a call. Disconnect first.");
      return;
    }

    const socket = createWebSocket(room, disconnect);
    setWs(socket);

    socket.onopen = async () => {
      setStatus("waiting");

      const peer = createPeerConnection(socket, localVideo, remoteVideo, () => {
        stopTimer();
        setStatus("connected");
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
          disconnect();
        }
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.send(JSON.stringify({ sdp: peer.localDescription }));

      startTimer(120);
    };
  };

  return (
    <div className="app-container">
      <Header />
      <StatusIndicator status={status} />

      <VideoGrid localRef={localVideo} remoteRef={remoteVideo} />

      <RoomInput room={room} setRoom={setRoom} />

      {timeLeft !== null && <TimerProgress timeLeft={timeLeft} />}

      <div className="button-group">
        <button
          onClick={startCall}
          disabled={pc || ws}
          className={`btn ${pc || ws ? "btn-disabled" : "btn-green"}`}
        >
          📞 Start Call
        </button>

        <button onClick={disconnect} className="btn btn-red">
          ❌ Disconnect
        </button>
      </div>
    </div>
  );
}
