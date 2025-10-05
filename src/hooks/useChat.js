// src/hooks/useChat.js
import { useState, useRef } from "react";
import { log } from "../utils/logger";

export default function useChat() {
  const [messages, setMessages] = useState([]);
  const [chatChannel, setChatChannel] = useState(null);
  const pendingMessages = useRef([]);

  /** ---- ATTACH DATA CHANNEL ---- */
  const attachChatChannel = (channel) => {
    channel.onopen = () => {
      log.success("Chat", "💬 DataChannel open");
      setChatChannel(channel);

      // Flush queued messages
      if (pendingMessages.current.length > 0) {
        log.info("Chat", `📤 Sending ${pendingMessages.current.length} queued messages`);
        pendingMessages.current.forEach((msg) => channel.send(msg));
        pendingMessages.current = [];
      }
    };

    channel.onclose = () => {
      log.warn("Chat", "⚠️ DataChannel closed");
      setChatChannel(null);
    };

    channel.onerror = (err) => {
      log.error("Chat", "❌ DataChannel error:", err);
    };
  };

  /** ---- HANDLE INCOMING CHAT MESSAGE ---- */
  const handleIncomingChat = (data) => {
    if (typeof data === "string") {
      try {
        const obj = JSON.parse(data);
        // Ignore file JSON messages handled by useFileShare
        if (obj.fileStart || obj.fileEnd) return;
      } catch {
        log.info("Chat", `📩 Message received: "${data}"`);
        setMessages((prev) => [...prev, { sender: "remote", text: data }]);
      }
    }
  };

  /** ---- SEND CHAT MESSAGE ---- */
  const sendMessage = (msg) => {
    if (!msg.trim()) return;

    log.info("Chat", `✉️ Sending message: "${msg}"`);
    setMessages((prev) => [...prev, { sender: "me", text: msg }]);

    if (chatChannel && chatChannel.readyState === "open") {
      chatChannel.send(msg);
      log.success("Chat", "✅ Message sent successfully");
    } else {
      log.warn("Chat", "🕓 Chat channel not open — message queued");
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
