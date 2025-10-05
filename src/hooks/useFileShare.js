// src/hooks/useFileShare.js
import { useState } from "react";
import { log } from "../utils/logger";

export default function useFileShare(setMessages) {
  const [receivingFile, setReceivingFile] = useState(null);

  /** ---- HANDLE INCOMING FILE DATA ---- */
  const handleFileData = (data) => {
    if (data instanceof ArrayBuffer) {
      setReceivingFile((prev) =>
        prev ? { ...prev, buffers: [...prev.buffers, data] } : prev
      );
      log.debug("FileShare", "📦 Received binary chunk...");
      return;
    }

    if (typeof data === "string") {
      try {
        const obj = JSON.parse(data);

        if (obj.fileStart) {
          log.info("FileShare", `📥 Start receiving file: ${obj.fileStart} (${obj.size} bytes)`);
          setReceivingFile({ name: obj.fileStart, size: obj.size, buffers: [] });
          return;
        }

        if (obj.fileEnd) {
          log.success("FileShare", "✅ Finished receiving file.");
          setReceivingFile((prev) => {
            if (!prev) return null;
            const blob = new Blob(prev.buffers);
            const url = URL.createObjectURL(blob);
            setMessages((msgs) => [
              ...msgs,
              {
                sender: "remote",
                text: "📁 Received file:",
                fileName: prev.name,
                fileUrl: url,
              },
            ]);
            log.success("FileShare", `📂 File saved: ${prev.name}`);
            return null;
          });
          return;
        }
      } catch {
        // Not a file JSON message — ignore
      }
    }
  };

  /** ---- SEND FILE ---- */
  const sendFile = (file, chatChannel) => {
    if (!file) return;
    if (!chatChannel || chatChannel.readyState !== "open") {
      log.warn("FileShare", "⚠️ Chat channel not open — cannot send file.");
      alert("Chat channel not open");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      log.warn("FileShare", "🚫 File too large (max 50MB).");
      alert("File too large (max 50MB)");
      return;
    }

    log.info("FileShare", `📤 Sending file: ${file.name} (${file.size} bytes)`);
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
      log.debug("FileShare", `📦 Sent chunk: ${progress}%`);
      if (offset < file.size) {
        readSlice(offset);
      } else {
        chatChannel.send(JSON.stringify({ fileEnd: file.name }));
        log.success("FileShare", `✅ File fully sent: ${file.name}`);
      }
    };

    chatChannel.send(JSON.stringify({ fileStart: file.name, size: file.size }));
    readSlice(0);

    const fileUrl = URL.createObjectURL(file);
    setMessages((prev) => [
      ...prev,
      { sender: "me", text: "📁 Sent file:", fileName: file.name, fileUrl },
    ]);
  };

  return { receivingFile, handleFileData, sendFile };
}
