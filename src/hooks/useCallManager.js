// src/hooks/useCallManager.js
import { useState, useRef, useEffect, useCallback } from "react";
import {
  createPeerConnection,
  cleanupPeerConnection,
  createChatChannel,
} from "../utils/webrtc";
import { createWebSocket } from "../utils/signaling";

export default function useCallManager(localVideo, remoteVideo) {
  const [pc, setPc] = useState(null);
  const [ws, setWs] = useState(null);
  const [room, setRoom] = useState("");
  const [timeLeft, setTimeLeft] = useState(null);
  const [status, setStatus] = useState("disconnected");

  const timerRef = useRef(null);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [chatChannel, setChatChannel] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [receivingFile, setReceivingFile] = useState(null);
  const [, setPendingMessages] = useState([]);

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

  // ---- Disconnect ----
  const disconnect = useCallback(() => {
    stopTimer();
    setStatus("disconnected");

    try {
      if (chatChannel && chatChannel.readyState !== "closed") chatChannel.close();
    } catch (_) {}

    cleanupPeerConnection(pc, ws, localVideo, remoteVideo);

    setPc(null);
    setWs(null);
    setChatChannel(null);
    setMessages([]);
    setReceivingFile(null);
  }, [pc, ws, chatChannel, localVideo, remoteVideo]);

  // ---- Handle incoming chat/file ----
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

  // ---- Setup DataChannel ----
  const setupDataChannel = (dc, label) => {
    if (!dc) return;
    dc.binaryType = "arraybuffer";
    dc.onmessage = (e) => handleIncomingData(e.data);
    dc.onopen = () => {
      console.log(`✅ DataChannel open (${label})`);
      setChatChannel(dc);
      setStatus("connected");
    };
    dc.onclose = () => setChatChannel(null);
    dc.onerror = () => setChatChannel(null);
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

      const peer = createPeerConnection(socket, localVideo, remoteVideo, () => {
        console.log("🎥 Remote track received");
        stopTimer();
        setStatus("connected");
      });
      setPc(peer);

      // Inbound DC
      peer.ondatachannel = (event) => setupDataChannel(event.channel, "inbound");

      // Outbound DC
      const dc = createChatChannel(peer, handleIncomingData);
      setupDataChannel(dc, "outbound");

      // Local media
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

      // Signaling
      socket.onmessage = async (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        if (data.sdp) {
          await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
          if (data.sdp.type === "offer") {
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            socket.send(JSON.stringify({ sdp: peer.localDescription }));
            stopTimer();
            setStatus("connected");
          }
        } else if (data.ice) {
          try {
            await peer.addIceCandidate(new RTCIceCandidate(data.ice));
          } catch (err) {
            console.warn("⚠️ addIceCandidate failed:", err);
          }
        }
      };

      socket.onclose = () => {
        setStatus("disconnected");
        setChatChannel(null);
      };

      // Caller sends offer
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
    if (chatChannel?.readyState === "open") {
      chatChannel.send(chatInput);
    } else {
      setPendingMessages((prev) => [...prev, chatInput]);
    }
    setChatInput("");
  };

  // ---- Send file ----
  const sendFile = (file) => {
    if (!file || !chatChannel || chatChannel.readyState !== "open") return;
    const chunkSize = 16 * 1024;
    const reader = new FileReader();
    let offset = 0;

    const readSlice = (o) => reader.readAsArrayBuffer(file.slice(o, o + chunkSize));

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

  // Cleanup
  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    room,
    setRoom,
    timeLeft,
    status,
    messages,
    chatInput,
    setChatInput,
    receivingFile,
    startCall,
    disconnect,
    sendMessage,
    sendFile,
    pc,
    ws,
  };
}
