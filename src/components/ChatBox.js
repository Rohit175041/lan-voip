import React, { useRef, useEffect } from "react";
import { FiSend, FiPaperclip } from "react-icons/fi";
import "./ChatBox.css";

export default function ChatBox({
  status,
  messages,
  chatInput,
  setChatInput,
  sendMessage,
  sendFile,
  receivingFile,
}) {
  const chatEndRef = useRef(null);

  // Auto-scroll to bottom when new messages come
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // If not connected, don't render the chat box
  if (status !== "connected") return null;

  const handleSend = () => {
    if (chatInput.trim()) {
      sendMessage();
    }
  };

  return (
    <div className="chat-container">
      {/* ===== Header ===== */}
      {/* <div className="chat-header">
        <span>💬 Chat</span>
        <span className={`chat-status ${status}`}>{status}</span>
      </div> */}

      {/* ===== Messages ===== */}
      <div className="chat-messages">
        {receivingFile && (
          <div className="file-receiving">
            Receiving <b>{receivingFile.name}</b>…
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`chat-message-wrapper ${m.sender}`}>
            <div className={`chat-message ${m.sender}`}>
              {m.fileUrl ? (
                <>
                  <a
                    href={m.fileUrl}
                    download={m.fileName}
                    className="file-link"
                  >
                    📁 {m.fileName}
                  </a>
                  <span className="msg-time">
                    {new Date().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </>
              ) : (
                <>
                  <span>{m.text}</span>
                  <span className="msg-time">
                    {new Date().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </>
              )}
            </div>
          </div>
        ))}
        {/* Always keep scroll pinned to last element */}
        <div ref={chatEndRef}></div>
      </div>

      {/* ===== Footer ===== */}
      <div className="chat-footer">
        {/* File input (hidden) */}
        <input
          type="file"
          onChange={(e) => {
            if (e.target.files.length) sendFile(e.target.files[0]);
          }}
          style={{ display: "none" }}
          id="fileInput"
        />
        <label htmlFor="fileInput" className="file-btn" title="Send File">
          <FiPaperclip size={18} />
        </label>

        {/* Message input */}
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message..."
          className="chat-input"
          disabled={status !== "connected"}
        />

        {/* Send button */}
        <button onClick={handleSend} className="chat-btn" title="Send Message">
          <FiSend size={18} />
        </button>
      </div>
    </div>
  );
}
