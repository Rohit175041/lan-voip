import React from "react";
import "./RoomInput.css";

export default function RoomInput({ room, setRoom }) {
  return (
    <div className="room-input">
      <input
        type="text"
        value={room}
        onChange={(e) => setRoom(e.target.value)}
        placeholder="Enter Room ID"
      />
      {room && (
        <button onClick={() => navigator.clipboard.writeText(room)} title="Copy Room ID">
          📋
        </button>
      )}
    </div>
  );
}

