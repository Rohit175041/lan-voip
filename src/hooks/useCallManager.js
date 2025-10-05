// src/hooks/useCallManager.js
import { useRef, useCallback, useEffect } from "react";
import useTime from "./useTime";
import useChat from "./useChat";
import useFileShare from "./useFileShare";
import { createWebSocket } from "../utils/signaling";
import {
  createPeerConnection,
  cleanupPeerConnection,
  createChatChannel,
} from "../utils/webrtc";

export default function useCallManager(local, remote) {
  const pc = useRef(null);
  const ws = useRef(null);

  // Custom hooks
  const { timeLeft, status, setStatus, startTimer, stopTimer } = useTime();
  const {
    messages,
    setMessages,
    chatChannel,
    setChatChannel,
    attachChatChannel,
    handleIncomingChat,
    sendMessage,
  } = useChat();
  const { receivingFile, handleFileData, sendFile: sendFileInternal } =
    useFileShare(setMessages);

  // Wrap sendFile so user doesn't have to pass chatChannel
  const sendFile = useCallback(
    (file) => sendFileInternal(file, chatChannel),
    [sendFileInternal, chatChannel]
  );

  /** ---- DISCONNECT ---- */
  const disconnect = useCallback(() => {
    console.log("🔌 [disconnect] Cleaning up...");
    stopTimer();
    setStatus("disconnected");
    cleanupPeerConnection(pc.current, ws.current, local, remote);
    pc.current = null;
    ws.current = null;
    setChatChannel(null);
  }, [stopTimer, setStatus, local, remote, setChatChannel]);

  /** ---- START CALL ---- */
  const startCall = useCallback(
    async (room) => {
      if (!room.trim()) return alert("Enter Room ID");
      if (pc.current || ws.current) return alert("Already in a call");

      console.log("🚀 [startCall] Room:", room);
      const socket = createWebSocket(room, disconnect);
      ws.current = socket;

      socket.onopen = async () => {
        console.log("🔗 WebSocket connected");
        setStatus("waiting");

        const peer = createPeerConnection(socket, local, remote, () => {
          console.log("✅ Remote stream added");
          stopTimer();
          setStatus("connected");
        });
        pc.current = peer;

        /** ---- Data Channels ---- */
        peer.ondatachannel = (e) => {
          console.log("📡 Incoming data channel:", e.channel.label);
          const channel = e.channel;
          channel.binaryType = "arraybuffer";
          attachChatChannel(channel);
          channel.onmessage = (ev) => {
            handleFileData(ev.data);
            handleIncomingChat(ev.data);
          };
        };

        const dc = createChatChannel(peer, (data) => {
          handleFileData(data);
          handleIncomingChat(data);
        });
        dc.binaryType = "arraybuffer";
        attachChatChannel(dc);

        /** ---- Media ---- */
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          if (local.current) local.current.srcObject = stream;
          stream.getTracks().forEach((t) => peer.addTrack(t, stream));
        } catch (err) {
          console.error("❌ Media error:", err);
          alert("Camera/Mic denied");
          socket.close();
          return;
        }

        /** ---- Signaling ---- */
        socket.onmessage = async (event) => {
          try {
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
            }
          } catch (err) {
            console.warn("[Signaling] Invalid message", err);
          }
        };

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.send(JSON.stringify({ sdp: peer.localDescription }));
        startTimer(120);
      };
    },
    [
      disconnect,
      stopTimer,
      setStatus,
      attachChatChannel,
      handleFileData,
      handleIncomingChat,
      startTimer,
      local,
      remote,
    ]
  );

  /** ---- CLEANUP ---- */
  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    status,
    timeLeft,
    messages,
    receivingFile,
    startCall,
    disconnect,
    sendMessage,
    sendFile,
  };
}
