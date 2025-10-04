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
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const [room, setRoom] = useState("");

  const {
    status,
    messages,
    receivingFile,
    timeLeft,
    startCall,
    disconnect,
    sendMessage,
    sendFile,
  } = useCallManager(localVideo, remoteVideo);

  return (
    <div className="app-container">
      <div className="card-wrapper">
        <Header />
        <div className="call-card">
          <StatusIndicator status={status} />
          <VideoGrid localRef={localVideo} remoteRef={remoteVideo} />
          {status !== "connected" && <RoomInput room={room} setRoom={setRoom} />}
          {timeLeft !== null && <TimerProgress timeLeft={timeLeft} />}
          <ChatBox
            status={status}
            messages={messages}
            sendMessage={sendMessage}
            sendFile={sendFile}
            receivingFile={receivingFile}
          />
          <CallButtons
            onStart={() => startCall(room)}
            onDisconnect={disconnect}
            disabled={status !== "disconnected"}
          />
        </div>
      </div>
    </div>
  );
}
