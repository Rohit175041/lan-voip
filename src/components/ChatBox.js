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

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (status !== "connected") return null;

  const handleSend = () => {
    if (chatInput.trim()) {
      sendMessage();
    }
  };

  const formatTimestamp = (value) => {
    if (!value) return "";
    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <span className="chat-title">Live Chat</span>
      </div>

      <div className="chat-messages">
        {receivingFile && (
          <div className="file-receiving">
            Receiving <b>{receivingFile.name}</b>...
          </div>
        )}

        {messages.length === 0 && (
          <div className="chat-empty">Messages will appear here once you connect.</div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`chat-message-wrapper ${m.sender}`}>
            <div className={`chat-message ${m.sender}`}>
              {m.fileUrl ? (
                <>
                  <a href={m.fileUrl} download={m.fileName} className="file-link">
                    {m.fileName}
                  </a>
                  <span className="msg-time">{formatTimestamp(m.timestamp)}</span>
                </>
              ) : (
                <>
                  <span>{m.text}</span>
                  <span className="msg-time">{formatTimestamp(m.timestamp)}</span>
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={chatEndRef}></div>
      </div>

      <div className="chat-footer">
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

        <button onClick={handleSend} className="chat-btn" title="Send Message">
          <FiSend size={18} />
        </button>
      </div>
    </div>
  );
}
