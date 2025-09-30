// App.js
import React, { useRef, useState, useEffect } from "react";
import "./App.css";

import Header from "./components/Header";
import StatusIndicator from "./components/StatusIndicator";
import VideoGrid from "./components/VideoGrid";
import RoomInput from "./components/RoomInput";
import TimerProgress from "./components/TimerProgress";

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

  // Chat + file
  const [messages, setMessages] = useState([]);
  const [chatChannel, setChatChannel] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [pendingMessages, setPendingMessages] = useState([]);
  const [receivingFile, setReceivingFile] = useState(null);
  const chatEndRef = useRef(null);

  // ---- Auto scroll chat ----
  useEffect(() => {
    if (chatEndRef.current)
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  // ---- Disconnect / cleanup ----
  const disconnect = () => {
    stopTimer();
    setStatus("disconnected");
    cleanupPeerConnection(pc, ws, localVideo, remoteVideo);
    setPc(null);
    setWs(null);
    setChatChannel(null);
    setMessages([]);
    setPendingMessages([]);
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
          console.log("📦 File transfer start:", obj.fileStart);
          setReceivingFile({ name: obj.fileStart, size: obj.size, buffers: [] });
          return;
        }
        if (obj.fileEnd) {
          console.log("✅ File transfer finished");
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

      const dc = createChatChannel(peer, handleIncomingData);
      dc.onopen = () => {
        console.log("✅ Chat channel open");
        setChatChannel(dc);
        pendingMessages.forEach((m) => dc.send(m));
        setPendingMessages([]);
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

  // ---- Send text ----
  const sendMessage = () => {
    if (!chatInput.trim()) return;
    setMessages((prev) => [...prev, { sender: "me", text: chatInput }]);
    if (chatChannel && chatChannel.readyState === "open") {
      chatChannel.send(chatInput);
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
      <Header />
      <StatusIndicator status={status} />
      <VideoGrid localRef={localVideo} remoteRef={remoteVideo} />
      <RoomInput room={room} setRoom={setRoom} />
      {timeLeft !== null && <TimerProgress timeLeft={timeLeft} />}

      {status === "connected" && (
        <div
          style={{
            marginTop: "1rem",
            width: "340px",
            height: "300px",
            display: "flex",
            flexDirection: "column",
            borderRadius: "12px",
            background: "rgba(30,30,30,0.85)",
            backdropFilter: "blur(8px)",
            overflow: "hidden",
            boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              padding: "0.6rem 1rem",
              background: "rgba(255,255,255,0.05)",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              fontSize: "0.95rem",
              color: "#ddd",
            }}
          >
            💬 Chat
          </div>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {/* ✅ File receiving progress indicator */}
            {receivingFile && (
              <div style={{ color: "#ccc", fontSize: "0.8rem", margin: "4px" }}>
                Receiving <b>{receivingFile.name}</b>…
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: m.sender === "me" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    background: m.sender === "me" ? "#4caf50" : "#2196f3",
                    color: "#fff",
                    padding: "8px 12px",
                    borderRadius:
                      m.sender === "me"
                        ? "16px 16px 0 16px"
                        : "16px 16px 16px 0",
                    maxWidth: "75%",
                    fontSize: "0.9rem",
                    wordBreak: "break-word",
                  }}
                >
                  {m.fileUrl ? (
                    <a
                      href={m.fileUrl}
                      download={m.fileName}
                      style={{
                        color: "#fff",
                        textDecoration: "underline",
                      }}
                    >
                      📁 {m.fileName}
                    </a>
                  ) : (
                    m.text
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef}></div>
          </div>

          {/* ---- Bottom bar ---- */}
          <div
            style={{
              display: "flex",
              padding: "0.5rem",
              background: "rgba(255,255,255,0.05)",
              borderTop: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <input
              type="file"
              onChange={(e) => {
                if (e.target.files.length) sendFile(e.target.files[0]);
              }}
              style={{ display: "none" }}
              id="fileInput"
            />
            <label
              htmlFor="fileInput"
              style={{
                background: "#4caf50",
                borderRadius: "50%",
                width: "38px",
                height: "38px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                cursor: "pointer",
                marginRight: "0.5rem",
                fontSize: "1.1rem",
                color: "#fff",
              }}
              title="Send File"
            >
              📎
            </label>

            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={
                chatChannel ? "Type a message..." : "Connecting chat..."
              }
              style={{
                flex: 1,
                padding: "0.5rem 0.75rem",
                borderRadius: "20px",
                border: "none",
                fontSize: "0.9rem",
                marginRight: "0.5rem",
                background: "rgba(255,255,255,0.15)",
                color: "#fff",
                outline: "none",
              }}
              disabled={status !== "connected"}
            />
            <button
              onClick={sendMessage}
              style={{
                background: "#4caf50",
                border: "none",
                color: "#fff",
                borderRadius: "50%",
                width: "38px",
                height: "38px",
                cursor: "pointer",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                fontSize: "1.1rem",
              }}
              title="Send Message"
            >
              ➤
            </button>
          </div>
        </div>
      )}

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
