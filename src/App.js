// App.js
import React, { useRef, useState } from "react";
import { FaPhone, FaPhoneSlash } from "react-icons/fa";
import "./App.css";

import Header from "./components/Header";
import StatusIndicator from "./components/StatusIndicator";
import VideoGrid from "./components/VideoGrid";
import RoomInput from "./components/RoomInput";
import TimerProgress from "./components/TimerProgress";
import ChatBox from "./components/ChatBox";

import {
  createPeerConnection,
  cleanupPeerConnection,
  createChatChannel,
} from "./utils/webrtc";
import { createWebSocket } from "./utils/signaling";

export default function App() {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  const [pc, setPc] = useState(null);
  const [ws, setWs] = useState(null);
  const [room, setRoom] = useState("");
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);
  const [status, setStatus] = useState("disconnected");

  // Chat state
  const [messages, setMessages] = useState([]);
  const [chatChannel, setChatChannel] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [pendingMessages, setPendingMessages] = useState([]);
  const [receivingFile, setReceivingFile] = useState(null);

  // ---- Timer ----
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

  // Helper: flush queued chat to an open channel
  const flushQueued = (dc) => {
    setPendingMessages((queued) => {
      if (dc && dc.readyState === "open" && queued && queued.length) {
        try {
          queued.forEach((m) => dc.send(m));
        } catch (err) {
          console.warn("Failed flushing queued messages:", err);
          return queued;
        }
      }
      return []; // clear on success
    });
  };

  // ---- Disconnect / cleanup ----
  const disconnect = () => {
    stopTimer();
    setStatus("disconnected");
    try {
      if (chatChannel && chatChannel.readyState !== "closed") {
        chatChannel.close();
      }
    } catch (_) {}

    cleanupPeerConnection(pc, ws, localVideo, remoteVideo);

    setPc(null);
    setWs(null);
    setChatChannel(null);
    setMessages([]);
    setReceivingFile(null);
  };

  // ---- Incoming data ----
  const handleIncomingData = (data) => {
    if (data instanceof ArrayBuffer) {
      setReceivingFile((prev) =>
        prev ? { ...prev, buffers: [...prev.buffers, data] } : prev
      );
      return;
    }
    if (data instanceof Blob) {
      data.arrayBuffer().then((buf) =>
        setReceivingFile((prev) =>
          prev ? { ...prev, buffers: [...prev.buffers, buf] } : prev
        )
      );
      return;
    }
    if (typeof data === "string") {
      try {
        const obj = JSON.parse(data);
        if (obj.fileStart) {
          setReceivingFile({ name: obj.fileStart, size: obj.size, buffers: [] });
          return;
        }
        if (obj.fileEnd) {
          setReceivingFile((prev) => {
            if (!prev) return null;
            const blob = new Blob(prev.buffers);
            const url = URL.createObjectURL(blob);
            setMessages((p) => [
              ...p,
              {
                sender: "remote",
                text: "📁 Received file:",
                fileName: prev.name,
                fileUrl: url,
              },
            ]);
            return null;
          });
          return;
        }
      } catch {
        setMessages((prev) => [...prev, { sender: "remote", text: data }]);
      }
    }
  };

  // ---- Start Call ----
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

      const peer = createPeerConnection(
        socket,
        localVideo,
        remoteVideo,
        () => {
          stopTimer();
          setStatus("connected");
        },
        handleIncomingData
      );
      setPc(peer);

      // Accept remote data channels
      peer.ondatachannel = (event) => {
        const dc = event.channel;
        dc.onmessage = (e) => handleIncomingData(e.data);
        dc.onopen = () => {
          setChatChannel(dc);
          flushQueued(dc);
        };
        dc.onclose = () => setChatChannel(null);
        dc.onerror = () => setChatChannel(null);
      };

      // Create our outbound chat channel
      const dc = createChatChannel(peer, handleIncomingData);
      dc.onopen = () => {
        setChatChannel(dc);
        flushQueued(dc);
      };
      dc.onclose = () => setChatChannel(null);
      dc.onerror = () => setChatChannel(null);

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

      // --- Handle signaling messages ---
      socket.onmessage = async (event) => {
        const data = JSON.parse(event.data);

        if (data.sdp) {
          const desc = new RTCSessionDescription(data.sdp);

          // ✅ Guards against duplicate/invalid SDP
          if (desc.type === "answer" && peer.signalingState === "stable") {
            console.warn("Skipping duplicate answer, already stable");
            return;
          }
          if (desc.type === "offer" && peer.signalingState !== "stable") {
            console.warn("Skipping unexpected offer, state:", peer.signalingState);
            return;
          }

          try {
            await peer.setRemoteDescription(desc);

            if (desc.type === "offer") {
              const answer = await peer.createAnswer();
              await peer.setLocalDescription(answer);
              socket.send(JSON.stringify({ sdp: peer.localDescription }));
            }
          } catch (err) {
            console.error(
              "❌ Failed to setRemoteDescription:",
              err,
              "state:",
              peer.signalingState
            );
          }
        } else if (data.ice) {
          try {
            await peer.addIceCandidate(new RTCIceCandidate(data.ice));
          } catch (err) {
            console.warn("Error adding ICE candidate", err);
          }
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

      socket.onclose = () => {
        setStatus("disconnected");
        setChatChannel(null);
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.send(JSON.stringify({ sdp: peer.localDescription }));
      startTimer(120);
    };
  };

  // ---- Send text ----
  const sendMessage = () => {
    if (!chatInput.trim()) return;
    setMessages((prev) => [...prev, { sender: "me", text: chatInput }]);

    if (chatChannel && chatChannel.readyState === "open") {
      try {
        chatChannel.send(chatInput);
      } catch (err) {
        setPendingMessages((prev) => [...prev, chatInput]);
      }
    } else {
      setPendingMessages((prev) => [...prev, chatInput]);
    }
    setChatInput("");
  };

  // ---- Send file ----
  const sendFile = (file) => {
    if (!file) return;
    if (!chatChannel || chatChannel.readyState !== "open") {
      alert("Chat channel not open");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      alert("File is too large (max 50 MB).");
      return;
    }

    const chunkSize = 16 * 1024;
    const reader = new FileReader();
    let offset = 0;

    const readSlice = (o) => {
      const slice = file.slice(o, o + chunkSize);
      reader.readAsArrayBuffer(slice);
    };

    reader.onload = (e) => {
      chatChannel.send(e.target.result);
      offset += e.target.result.byteLength;
      if (offset < file.size) readSlice(offset);
      else chatChannel.send(JSON.stringify({ fileEnd: file.name }));
    };

    chatChannel.send(JSON.stringify({ fileStart: file.name, size: file.size }));
    readSlice(0);

    const fileUrl = URL.createObjectURL(file);
    setMessages((prev) => [
      ...prev,
      { sender: "me", text: "📁 Sent file:", fileName: file.name, fileUrl },
    ]);
  };

  return (
    <div className="app-container">
      <div className="card-wrapper">
        <Header />
        <div className="call-card">
          <div className="status-wrapper">
            <StatusIndicator status={status} />
          </div>

          <VideoGrid localRef={localVideo} remoteRef={remoteVideo} />
          <RoomInput room={room} setRoom={setRoom} />
          {timeLeft !== null && <TimerProgress timeLeft={timeLeft} />}

          <ChatBox
            status={status}
            messages={messages}
            chatInput={chatInput}
            setChatInput={setChatInput}
            sendMessage={sendMessage}
            sendFile={sendFile}
            receivingFile={receivingFile}
          />

          <div className="button-group">
            <button
              onClick={startCall}
              disabled={!!pc || !!ws}
              className={`btn ${pc || ws ? "btn-disabled" : "btn-green"}`}
            >
              <FaPhone /> Start Call
            </button>
            <button onClick={disconnect} className="btn btn-red">
              <FaPhoneSlash /> Disconnect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
