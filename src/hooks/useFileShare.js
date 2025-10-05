// src/hooks/useFileShare.js
import { useState, useCallback } from "react";

export default function useFileShare(setMessages) {
  const [receivingFile, setReceivingFile] = useState(null);

  /** Handle incoming file data */
  const handleFileData = useCallback(
    (data) => {
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
          }
        } catch {
          return;
        }
      }
    },
    [setMessages]
  );

  /** Send file */
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
    [setMessages]
  );

  return { receivingFile, handleFileData, sendFile };
}
