// src/hooks/useCallManager.js
import { useRef, useState, useEffect, useCallback } from "react";
import {
  createPeerConnection,
  cleanupPeerConnection,
  createChatChannel,
} from "../utils/webrtc";
import { createWebSocket } from "../utils/signaling";

export default function useCallManager(localVideo, remoteVideo) {
  const [status, setStatus] = useState("disconnected");
  const [messages, setMessages] = useState([]);
  const [chatChannel, setChatChannel] = useState(null);
  const [receivingFile, setReceivingFile] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

  const pc = useRef(null);
  const ws = useRef(null);
  const timerRef = useRef(null);
  const pendingMessages = useRef([]);

  // ---- STOP TIMER ----
  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setTimeLeft(null);
  }, []);

  // ---- DISCONNECT ----
  const disconnect = useCallback(() => {
    stopTimer();
    setStatus("disconnected");
    cleanupPeerConnection(pc.current, ws.current, localVideo, remoteVideo);
    pc.current = null;
    ws.current = null;
    setChatChannel(null);
    setMessages([]);
    setReceivingFile(null);
    pendingMessages.current = [];
  }, [stopTimer, localVideo, remoteVideo]);

  // ---- START TIMER ----
  const startTimer = useCallback(
    (seconds) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setTimeLeft(seconds);
      setStatus("waiting");
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setStatus("disconnected");
            alert("No one joined within 2 minutes. Call ended.");
            disconnect();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [disconnect] // ✅ FIX: include disconnect
  );

  // ---- HANDLE INCOMING DATA ----
  const handleIncomingData = useCallback((data) => {
    if (data instanceof ArrayBuffer) {
      setReceivingFile((prev) =>
        prev ? { ...prev, buffers: [...prev.buffers, data] } : prev
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
  }, []);

  // ---- SEND MESSAGE ----
  const sendMessage = useCallback(
    (msg) => {
      if (!msg.trim()) return;
      setMessages((prev) => [...prev, { sender: "me", text: msg }]);
      if (chatChannel && chatChannel.readyState === "open") {
        chatChannel.send(msg);
      } else {
        pendingMessages.current.push(msg);
      }
    },
    [chatChannel]
  );

  // ---- SEND FILE ----
  const sendFile = useCallback(
    (file) => {
      if (!file) return;
      if (!chatChannel || chatChannel.readyState !== "open") {
        alert("Chat channel not open");
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        alert("File too large (max 50 MB).");
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
    },
    [chatChannel]
  );

  // ---- START CALL ----
  const startCall = useCallback(
    async (room) => {
      if (!room.trim()) {
        alert("⚠️ Enter a Room ID first");
        return;
      }
      if (pc.current || ws.current) {
        alert("⚠️ Already in a call. Disconnect first.");
        return;
      }

      const socket = createWebSocket(room, disconnect);
      ws.current = socket;

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
        pc.current = peer;

        // ICE reconnect
        peer.oniceconnectionstatechange = () => {
          if (peer.iceConnectionState === "disconnected") {
            setStatus("reconnecting");
          }
          if (peer.iceConnectionState === "failed") {
            disconnect();
            startCall(room);
          }
        };

        const dc = createChatChannel(peer, handleIncomingData);
        dc.onopen = () => {
          setChatChannel(dc);
          pendingMessages.current.forEach((m) => dc.send(m));
          pendingMessages.current = [];
        };

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          if (localVideo.current) localVideo.current.srcObject = stream;
          stream.getTracks().forEach((t) => peer.addTrack(t, stream));
        } catch (err) {
          alert("Camera/Mic denied");
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
          }
        };

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.send(JSON.stringify({ sdp: peer.localDescription }));
        startTimer(120);
      };
    },
    [disconnect, handleIncomingData, localVideo, remoteVideo, startTimer, stopTimer]
  );

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    status,
    messages,
    chatChannel,
    receivingFile,
    timeLeft,
    startCall,
    disconnect,
    sendMessage,
    sendFile,
  };
}
