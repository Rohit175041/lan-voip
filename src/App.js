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
    isCameraOn,
    isMicOn,
    startCall,
    disconnect,
    toggleCamera,
    toggleMic,
    sendMessage,
    sendFile,
  } = useCallManager(localRef, remoteRef);

  const handleSendMessage = () => {
    if (chatInput.trim()) {
      sendMessage(chatInput);
      setChatInput(""); // clear after sending
    }
  };

  const canStart =
    status === "disconnected" &&
    room.trim().length >= 6;
  const canDisconnect = status !== "disconnected";

  return (
    <div className="app-container">
      <div className="card-wrapper">
        <Header />

        <div className="call-card">
          <StatusIndicator status={status} />
          <VideoGrid
            localRef={localRef}
            remoteRef={remoteRef}
            isCameraOn={isCameraOn}
            isMicOn={isMicOn}
            onToggleCamera={toggleCamera}
            onToggleMic={toggleMic}
          />
          {timeLeft !== null && <TimerProgress timeLeft={timeLeft} />}

          <div className={`join-panel ${status === "connected" ? "join-panel-connected" : ""}`}>
            {status !== "connected" && (
              <div className="join-input">
                <RoomInput
                  room={room}
                  setRoom={setRoom}
                />
              </div>
            )}
            <div className="join-actions">
              <CallButtons
                onStart={() => startCall(room)}
                onDisconnect={disconnect}
                startDisabled={!canStart}
                disconnectDisabled={!canDisconnect}
              />
            </div>
          </div>

          <ChatBox
            status={status}
            messages={messages}
            chatInput={chatInput}
            setChatInput={setChatInput}
            sendMessage={handleSendMessage}
            sendFile={sendFile}
            receivingFile={receivingFile}
          />
        </div>
      </div>
    </div>
  );
}
