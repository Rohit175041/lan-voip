// src/hooks/useChat.js
import { useState, useRef, useCallback } from "react";

export default function useChat() {
  const [messages, setMessages] = useState([]);
  const [chatChannel, setChatChannel] = useState(null);
  const pendingMessages = useRef([]);

  /** Send message */
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

  /** Handle incoming text */
  const handleIncomingChat = useCallback((data) => {
    if (typeof data === "string") {
      try {
        const obj = JSON.parse(data);
        if (!obj.fileStart && !obj.fileEnd) {
          setMessages((prev) => [...prev, { sender: "remote", text: data }]);
        }
      } catch {
        setMessages((prev) => [...prev, { sender: "remote", text: data }]);
      }
    }
  }, []);

  /** Attach open DataChannel */
  const attachChatChannel = useCallback((dc) => {
    dc.binaryType = "arraybuffer";
    dc.onopen = () => {
      console.log("✅ [Chat] DataChannel open");
      setChatChannel(dc);
      pendingMessages.current.forEach((m) => dc.send(m));
      pendingMessages.current = [];
    };
    dc.onmessage = (e) => handleIncomingChat(e.data);
    dc.onclose = () => console.log("⚠️ [Chat] Channel closed");
  }, [handleIncomingChat]);

  return {
    messages,
    chatChannel,
    setChatChannel,
    sendMessage,
    handleIncomingChat,
    attachChatChannel,
  };
}
