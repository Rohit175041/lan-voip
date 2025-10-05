import React, { useState } from "react";
import "./RoomInput.css";

export default function RoomInput({ room, setRoom }) {
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const value = e.target.value;

    // ✅ Only digits
    if (/^\d*$/.test(value)) {
      if (value.length <= 10) {
        setRoom(value);

        if (value.length === 0) {
          setError("");
        } else if (value.length < 4) {
          setError("⚠️ Room ID must be at least 4 digits.");
        } else if (value.length > 10) {
          setError("⚠️ Room ID cannot exceed 10 digits.");
        } else {
          setError("");
        }
      }
    }
  };

  return (
    <div className="room-container">
      <div
        className={`room-input-wrapper ${error ? "room-input-error" : ""}`}
      >
        <input
          type="text"
          value={room}
          onChange={handleChange}
          placeholder="Enter User ID"
          maxLength={10}
          className="room-input"
        />
        {/* You can enable copy button if needed */}
        {/* {room && (
          <button
            onClick={() => navigator.clipboard.writeText(room)}
            title="Copy Room ID"
            className="copy-btn"
          >
            📋
          </button>
        // )} */}
      </div>

      {error && <span className="room-error">{error}</span>}
    </div>
  );
}
