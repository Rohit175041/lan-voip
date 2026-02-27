import React, { useState } from "react";
import "./RoomInput.css";

export default function RoomInput({ room, setRoom }) {
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const value = e.target.value;

    if (/^\d*$/.test(value) && value.length <= 10) {
      setRoom(value);

      if (value.length === 0) {
        setError("");
      } else if (value.length < 6) {
        setError("Room ID must be at least 6 digits.");
      } else {
        setError("");
      }
    }
  };

  return (
    <div className="room-container">
      <div className={`room-input-wrapper ${error ? "room-input-error" : ""}`}>
        <input
          type="text"
          value={room}
          onChange={handleChange}
          placeholder="Enter room ID"
          maxLength={10}
          className="room-input"
        />
      </div>
      {error && <span className="room-error">{error}</span>}
    </div>
  );
}
