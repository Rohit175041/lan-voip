// src/hooks/useCallManager.js
import { useRef, useState, useEffect, useCallback } from "react";
import {
  createPeerConnection,
  cleanupPeerConnection,
  createChatChannel,
} from "../utils/webrtc";
import { createWebSocket } from "../utils/signaling";
import { log } from "../utils/logger";

/**
 * Custom hook to handle WebRTC call logic
 */
export default function useCallManager(local, remote) {
  const [status, setStatus] = useState("disconnected");
  const [messages, setMessages] = useState([]);
  const [chatChannel, setChatChannel] = useState(null);
  const [receivingFile, setReceivingFile] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

  const pc = useRef(null);
  const ws = useRef(null);
  const timerRef = useRef(null);
  const pendingMessages = useRef([]);

  /** ---- CLEANUP ---- */
  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setTimeLeft(null);
    log.info("CallManager", "⏹️ Timer stopped.");
  }, []);

  const disconnect = useCallback(() => {
    log.warn("CallManager", "🔌 Disconnecting & cleaning up...");
    stopTimer();
    setStatus("disconnected");
    cleanupPeerConnection(pc.current, ws.current, local, remote);
    pc.current = null;
    ws.current = null;
    setChatChannel(null);
    setMessages([]);
    setReceivingFile(null);
    pendingMessages.current = [];
  }, [stopTimer, local, remote]);

  /** ---- TIMER ---- */
  const startTimer = useCallback(
    (seconds) => {
      log.info("CallManager", `⏳ Waiting timer started for ${seconds}s`);
      if (timerRef.current) clearInterval(timerRef.current);
      setTimeLeft(seconds);
      setStatus("waiting");
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            log.warn("CallManager", "⌛ Timeout reached — disconnecting call");
            clearInterval(timerRef.current);
            timerRef.current = null;
            setStatus("disconnected");
            alert("No one joined within 2 minutes. Call ended.");
            disconnect();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [disconnect]
  );

  /** ---- INCOMING DATA ---- */
  const handleIncomingData = useCallback((data) => {
    log.debug("DataChannel", "📩 Incoming data:", data);

    if (data instanceof ArrayBuffer) {
      setReceivingFile((prev) =>
        prev ? { ...prev, buffers: [...prev.buffers, data] } : prev
      );
      log.debug("File", "📦 Received binary chunk...");
      return;
    }

    if (typeof data === "string") {
      try {
        const obj = JSON.parse(data);
        if (obj.fileStart) {
          log.info("File", `📥 Start receiving file: ${obj.fileStart}`);
          setReceivingFile({ name: obj.fileStart, size: obj.size, buffers: [] });
          return;
        }
        if (obj.fileEnd) {
          log.success("File", "✅ File transfer complete");
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
            log.success("File", `📂 File saved: ${prev.name}`);
            return null;
          });
          return;
        }
      } catch {
        log.info("Chat", `💬 Message received: "${data}"`);
        setMessages((prev) => [...prev, { sender: "remote", text: data }]);
      }
    }
  }, []);

  /** ---- SEND MESSAGE ---- */
  const sendMessage = useCallback(
    (msg) => {
      if (!msg.trim()) return;
      log.info("Chat", `✉️ Sending message: "${msg}"`);
      setMessages((prev) => [...prev, { sender: "me", text: msg }]);
      if (chatChannel && chatChannel.readyState === "open") {
        chatChannel.send(msg);
        log.success("Chat", "✅ Message sent successfully");
      } else {
        log.warn("Chat", "🕓 Channel not open — queued message");
        pendingMessages.current.push(msg);
      }
    },
    [chatChannel]
  );

  /** ---- SEND FILE ---- */
  const sendFile = useCallback(
    (file) => {
      if (!file) return;
      if (!chatChannel || chatChannel.readyState !== "open") {
        log.warn("File", "⚠️ Chat channel not open — cannot send file");
        alert("Chat channel not open");
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        log.warn("File", "🚫 File too large (max 50 MB)");
        alert("File too large (max 50 MB)");
        return;
      }

      log.info("File", `📤 Sending file: ${file.name} (${file.size} bytes)`);
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
        const progress = ((offset / file.size) * 100).toFixed(1);
        log.debug("File", `📦 Sent chunk: ${progress}%`);
        if (offset < file.size) readSlice(offset);
        else {
          chatChannel.send(JSON.stringify({ fileEnd: file.name }));
          log.success("File", `✅ File fully sent: ${file.name}`);
        }
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

  /** ---- START CALL ---- */
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

      log.info("CallManager", `🚀 Starting call in room: ${room}`);
      const socket = createWebSocket(room, disconnect);
      ws.current = socket;

      socket.onopen = async () => {
        log.success("WebSocket", "🔗 Connected to signaling server");
        setStatus("waiting");

        log.info("Peer", "🛠️ Creating RTCPeerConnection...");
        const peer = createPeerConnection(socket, local, remote, () => {
          log.success("Peer", "✅ Remote stream added");
          stopTimer();
          setStatus("connected");
        });
        pc.current = peer;

        peer.oniceconnectionstatechange = () => {
          log.debug("ICE", `🌐 State: ${peer.iceConnectionState}`);
          if (peer.iceConnectionState === "disconnected") {
            log.warn("ICE", "⚠️ ICE disconnected — attempting reconnect");
            setStatus("reconnecting");
          }
          if (peer.iceConnectionState === "failed") {
            log.error("ICE", "❌ ICE connection failed — restarting call");
            disconnect();
            startCall(room);
          }
        };

        /** Incoming data channel */
        peer.ondatachannel = (e) => {
          log.info("DataChannel", `📡 Incoming channel: ${e.channel.label}`);
          const dc = e.channel;
          dc.binaryType = "arraybuffer";
          dc.onmessage = (msg) => handleIncomingData(msg.data);
          dc.onopen = () => {
            log.success("DataChannel", "✅ Open (incoming)");
            setChatChannel(dc);
            pendingMessages.current.forEach((m) => dc.send(m));
            pendingMessages.current = [];
          };
        };

        /** Outgoing data channel */
        log.info("DataChannel", "📡 Creating outbound channel");
        const dc = createChatChannel(peer, handleIncomingData);
        dc.onopen = () => {
          log.success("DataChannel", "✅ Open (outgoing)");
          setChatChannel(dc);
          pendingMessages.current.forEach((m) => dc.send(m));
          pendingMessages.current = [];
        };

        /** Media setup */
        try {
          log.info("Media", "🎥 Requesting camera & microphone access...");
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          if (local.current) local.current.srcObject = stream;
          stream.getTracks().forEach((t) => peer.addTrack(t, stream));
          log.success("Media", "✅ Media stream ready");
        } catch (err) {
          log.error("Media", "❌ Access denied or device error:", err);
          alert("Camera/Mic denied");
          socket.close();
          return;
        }

        /** Handle signaling messages */
        socket.onmessage = async (event) => {
          log.debug("Signaling", "📩 Received:", event.data);
          const data = JSON.parse(event.data);
          if (data.sdp) {
            log.info("SDP", `📜 Type: ${data.sdp.type}`);
            await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
            if (data.sdp.type === "offer") {
              const answer = await peer.createAnswer();
              await peer.setLocalDescription(answer);
              socket.send(JSON.stringify({ sdp: peer.localDescription }));
              log.success("SDP", "📤 Sent answer");
            }
          } else if (data.ice) {
            log.info("ICE", "🧊 Adding remote candidate");
            await peer.addIceCandidate(new RTCIceCandidate(data.ice));
          }
        };

        /** Create and send offer */
        log.info("SDP", "📤 Creating offer...");
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.send(JSON.stringify({ sdp: peer.localDescription }));
        log.success("SDP", "✅ Sent offer");

        startTimer(120);
      };

      socket.onerror = (err) => {
        log.error("WebSocket", "❌ Error:", err);
      };

      socket.onclose = () => {
        log.warn("WebSocket", "⚠️ Connection closed");
      };
    },
    [disconnect, handleIncomingData, local, remote, startTimer, stopTimer]
  );

  /** ---- CLEANUP ---- */
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
