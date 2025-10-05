// src/hooks/useFileShare.js
import { useState } from "react";

export default function useFileShare(setMessages) {
  const [receivingFile, setReceivingFile] = useState(null);

  const handleFileData = (data) => {
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
          console.log("📦 Start receiving file:", obj.fileStart);
          setReceivingFile({ name: obj.fileStart, size: obj.size, buffers: [] });
          return;
        }

        if (obj.fileEnd) {
          console.log("✅ Finished receiving file");
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
            return null;
          });
          return;
        }
      } catch {
        // Not a file message — ignore
      }
    }
  };

  const sendFile = (file, chatChannel) => {
    if (!file) return;
    if (!chatChannel || chatChannel.readyState !== "open") {
      alert("Chat channel not open");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      alert("File too large (max 50MB)");
      return;
    }

    console.log("📤 Sending file:", file.name, file.size, "bytes");
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
  };

  return { receivingFile, handleFileData, sendFile };
}
