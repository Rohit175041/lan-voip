// src/App.js
import React, { useRef, useState } from "react";
import "./App.css";

import Header from "./components/Header";
import StatusIndicator from "./components/StatusIndicator";
import VideoGrid from "./components/VideoGrid";
import RoomInput from "./components/RoomInput";
import TimerProgress from "./components/TimerProgress";
import ChatBox from "./components/ChatBox";
import CallButtons from "./components/CallButtons";

import useCallManager from "./hooks/useCallManager";

export default function App() {
  const localRef = useRef(null);
  const remoteRef = useRef(null);

  const [room, setRoom] = useState("");
  const [chatInput, setChatInput] = useState(""); 

  const {
    status,
    messages,
    receivingFile,
    timeLeft,
    startCall,
    disconnect,
    sendMessage,
    sendFile,
  } = useCallManager(localRef, remoteRef);

  const handleSendMessage = () => {
    if (chatInput.trim()) {
      sendMessage(chatInput);
      setChatInput(""); // clear after sending
    }
  };

  return (
    <div className="app-container">
      <div className="card-wrapper">
        <Header />
        <div className="call-card">
          <StatusIndicator status={status} />

          {/* ---- Video section ---- */}
          <VideoGrid localRef={localRef} remoteRef={remoteRef} />

          {/* ---- Room input ---- */}
          {status !== "connected" && (
            <div className="room-container">
              <RoomInput room={room} setRoom={setRoom} />
            </div>
          )}

          {/* ---- Timer ---- */}
          {timeLeft !== null && <TimerProgress timeLeft={timeLeft} />}

          {/* ---- Chat ---- */}
          <ChatBox
            status={status}
            messages={messages}
            chatInput={chatInput}
            setChatInput={setChatInput}
            sendMessage={handleSendMessage}
            sendFile={sendFile}
            receivingFile={receivingFile}
          />

          {/* ---- Call Buttons ---- */}
          <div className="button-group">
            <CallButtons
              onStart={() => startCall(room)}
              onDisconnect={disconnect}
              disabled={status !== "disconnected"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
