// src/hooks/useChat.js
import { useState, useRef } from "react";

export default function useChat() {
  const [messages, setMessages] = useState([]);
  const [chatChannel, setChatChannel] = useState(null);
  const pendingMessages = useRef([]);

  // attach an existing or new data channel
  const attachChatChannel = (channel) => {
    channel.onopen = () => {
      console.log("✅ [Chat] DataChannel open");
      setChatChannel(channel);
      pendingMessages.current.forEach((msg) => channel.send(msg));
      pendingMessages.current = [];
    };

    channel.onclose = () => {
      console.warn("⚠️ [Chat] Channel closed");
      setChatChannel(null);
    };
  };

  const handleIncomingChat = (data) => {
    if (typeof data === "string") {
      try {
        const obj = JSON.parse(data);
        // Ignore file JSON messages handled by useFileShare
        if (obj.fileStart || obj.fileEnd) return;
      } catch {
        console.log("💬 [Chat] Received:", data);
        setMessages((prev) => [...prev, { sender: "remote", text: data }]);
      }
    }
  };

  const sendMessage = (msg) => {
    if (!msg.trim()) return;
    console.log("💬 Sending:", msg);
    setMessages((prev) => [...prev, { sender: "me", text: msg }]);
    if (chatChannel && chatChannel.readyState === "open") {
      chatChannel.send(msg);
    } else {
      console.warn("Chat channel not open — queueing message");
      pendingMessages.current.push(msg);
    }
  };

  return {
    messages,
    setMessages,
    chatChannel,
    setChatChannel,
    attachChatChannel,
    handleIncomingChat,
    sendMessage,
  };
}
