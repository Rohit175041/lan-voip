import React, { useState } from "react";

export default function RoomInput({ room, setRoom }) {
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const value = e.target.value;

    // ✅ Allow only digits
    if (/^\d*$/.test(value)) {
      // Prevent user from typing more than 10 digits
      if (value.length <= 10) {
        setRoom(value);

        // ✅ Validation rules
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginTop: "1rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <input
          type="text"
          value={room}
          onChange={handleChange}
          placeholder="Enter Room ID"
          maxLength={10} // ✅ Prevents typing more than 10 digits
          style={{
            padding: "0.6rem 1rem",
            fontSize: "1rem",
            textAlign: "center",
            borderRadius: "25px",
            border: error ? "2px solid #ff4d4d" : "2px solid #ccc",
            width: "250px",
            marginRight: "8px",
            outline: "none",
          }}
        />
        {room && (
          <button
            onClick={() => navigator.clipboard.writeText(room)}
            title="Copy Room ID"
            style={{
              background: "#4caf50",
              border: "none",
              borderRadius: "50%",
              color: "white",
              width: "40px",
              height: "40px",
              cursor: "pointer",
              boxShadow: "0 3px 8px rgba(0,0,0,0.2)",
            }}
          >
            📋
          </button>
        )}
      </div>
      {/* ⚠️ Warning text */}
      {error && (
        <span
          style={{ color: "#ff4d4d", fontSize: "0.9rem", marginTop: "6px" }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
