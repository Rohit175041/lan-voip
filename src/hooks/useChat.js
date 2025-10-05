// src/hooks/useChat.js
import { useState, useRef, useCallback } from "react";

export default function useChat() {
  const [messages, setMessages] = useState([]);
  const [chatChannel, setChatChannel] = useState(null);
  const pendingMessages = useRef([]);

  /** ---- SEND MESSAGE ---- */
  const sendMessage = useCallback(
    (msg) => {
      if (!msg.trim()) return;

      // Add to local chat UI
      setMessages((prev) => [...prev, { sender: "me", text: msg }]);

      // Send if channel open, otherwise queue
      if (chatChannel && chatChannel.readyState === "open") {
        chatChannel.send(msg);
      } else {
        console.warn("💬 [Chat] Channel not open — queueing:", msg);
        pendingMessages.current.push(msg);
      }
    },
    [chatChannel]
  );

  /** ---- HANDLE INCOMING TEXT (non-file) ---- */
  const handleIncomingChat = useCallback((data) => {
    if (typeof data === "string") {
      try {
        const obj = JSON.parse(data);
        // Ignore file transfer control messages
        if (!obj.fileStart && !obj.fileEnd) {
          setMessages((prev) => [...prev, { sender: "remote", text: data }]);
        }
      } catch {
        // Not JSON → normal text
        setMessages((prev) => [...prev, { sender: "remote", text: data }]);
      }
    }
  }, []);

  /** ---- ATTACH DATA CHANNEL ---- */
  const attachChatChannel = useCallback(
    (dc) => {
      dc.binaryType = "arraybuffer"; // ✅ ensure binary mode for files
      dc.onopen = () => {
        console.log("✅ [Chat] DataChannel open");
        setChatChannel(dc);
        // Flush queued messages
        pendingMessages.current.forEach((m) => dc.send(m));
        pendingMessages.current = [];
      };
      dc.onmessage = (e) => handleIncomingChat(e.data);
      dc.onclose = () => console.log("⚠️ [Chat] Channel closed");
    },
    [handleIncomingChat]
  );

  return {
    messages,
    setMessages,        // ✅ exposed so file share can push file messages
    chatChannel,
    setChatChannel,
    sendMessage,
    handleIncomingChat,
    attachChatChannel,
  };
}
