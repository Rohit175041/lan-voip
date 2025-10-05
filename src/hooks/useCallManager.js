// src/hooks/useCallManager.js
import { useRef, useCallback, useEffect } from "react";
import useTime from "./useTime";
import useChat from "./useChat";
import useFileShare from "./useFileShare";
import { createWebSocket } from "../utils/signaling";
import { createPeerConnection, cleanupPeerConnection, createChatChannel } from "../utils/webrtc";

export default function useCallManager(local, remote) {
  const pc = useRef(null);
  const ws = useRef(null);

  const { timeLeft, status, setStatus, startTimer, stopTimer } = useTime();
  const { messages, sendMessage, chatChannel, attachChatChannel, setChatChannel } = useChat();
  const { receivingFile, handleFileData, sendFile } = useFileShare(setMessages);

  const disconnect = useCallback(() => {
    console.log("🔌 [disconnect] Cleanup");
    stopTimer();
    setStatus("disconnected");
    cleanupPeerConnection(pc.current, ws.current, local, remote);
    pc.current = null;
    ws.current = null;
    setChatChannel(null);
  }, [stopTimer, setStatus, local, remote, setChatChannel]);

  const startCall = useCallback(
    async (room) => {
      if (!room.trim()) {
        alert("Enter Room ID");
        return;
      }

      if (pc.current || ws.current) {
        alert("Already in call");
        return;
      }

      console.log("🚀 [Call] Starting for room:", room);
      const socket = createWebSocket(room, disconnect);
      ws.current = socket;

      socket.onopen = async () => {
        setStatus("waiting");
        const peer = createPeerConnection(socket, local, remote, () => {
          console.log("✅ Remote stream added");
          stopTimer();
          setStatus("connected");
        });
        pc.current = peer;

        peer.ondatachannel = (e) => {
          console.log("📡 Incoming channel:", e.channel.label);
          attachChatChannel(e.channel);
        };

        const dc = createChatChannel(peer, (data) => {
          handleFileData(data);
        });
        attachChatChannel(dc);

        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (local.current) local.current.srcObject = stream;
        stream.getTracks().forEach((t) => peer.addTrack(t, stream));

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
          }
        };

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.send(JSON.stringify({ sdp: peer.localDescription }));
        startTimer(120);
      };
    },
    [disconnect, stopTimer, setStatus, attachChatChannel, handleFileData, startTimer, local, remote]
  );

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
