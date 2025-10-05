// src/hooks/useFileShare.js
import { useState, useCallback } from "react";

/**
 * useFileShare
 * - Handles chunked file sending over a RTCDataChannel
 * - Reassembles files when receiving
 *
 * @param {Function} [setMessages] optional: pass from useChat to add messages
 */
export default function useFileShare(setMessages) {
  const [receivingFile, setReceivingFile] = useState(null);

  /** Handle incoming file data (called when data channel receives a message) */
  const handleFileData = useCallback(
    (data) => {
      // Binary chunk
      if (data instanceof ArrayBuffer) {
        setReceivingFile((prev) =>
          prev ? { ...prev, buffers: [...prev.buffers, data] } : prev
        );
        return;
      }

      // JSON control message
      if (typeof data === "string") {
        try {
          const obj = JSON.parse(data);

          if (obj.fileStart) {
            // Start receiving
            setReceivingFile({ name: obj.fileStart, size: obj.size, buffers: [] });
            return;
          }

          if (obj.fileEnd) {
            // File finished
            setReceivingFile((prev) => {
              if (!prev) return null;
              const blob = new Blob(prev.buffers);
              const url = URL.createObjectURL(blob);

              if (typeof setMessages === "function") {
                setMessages((msgs) => [
                  ...msgs,
                  {
                    sender: "remote",
                    text: "📁 Received file:",
                    fileName: prev.name,
                    fileUrl: url,
                  },
                ]);
              }

              return null; // reset
            });
            return;
          }
        } catch (err) {
          console.warn("[useFileShare] Failed to parse data:", err);
        }
      }
    },
    [setMessages]
  );

  /** Send a file over the data channel */
  const sendFile = useCallback(
    (file, chatChannel) => {
      if (!file || !chatChannel) return;
      if (file.size > 50 * 1024 * 1024) {
        alert("File too large (max 50 MB)");
        return;
      }

      console.log("📦 [File] Sending:", file.name);
      const chunkSize = 16 * 1024;
      const reader = new FileReader();
      let offset = 0;

      const readSlice = (o) => {
        const slice = file.slice(o, o + chunkSize);
        reader.readAsArrayBuffer(slice);
      };

      reader.onload = (e) => {
        if (chatChannel.readyState !== "open") {
          console.warn("[useFileShare] Channel not open, stopping send");
          return;
        }

        const buffer = e.target.result;
        chatChannel.send(buffer);
        offset += buffer.byteLength;

        if (offset < file.size) {
          readSlice(offset);
        } else {
          // Done
          chatChannel.send(JSON.stringify({ fileEnd: file.name }));
          console.log("✅ File sent:", file.name);
        }
      };

      // Notify receiver a file is coming
      chatChannel.send(JSON.stringify({ fileStart: file.name, size: file.size }));
      readSlice(0);

      // Add to local chat UI
      if (typeof setMessages === "function") {
        const fileUrl = URL.createObjectURL(file);
        setMessages((prev) => [
          ...prev,
          { sender: "me", text: "📁 Sent file:", fileName: file.name, fileUrl },
        ]);
      }
    },
    [setMessages]
  );

  return { receivingFile, handleFileData, sendFile };
}
