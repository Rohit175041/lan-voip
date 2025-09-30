export default function RoomInput({ room, setRoom }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginTop: "1rem" }}>
      <input
        type="text"
        value={room}
        onChange={(e) => setRoom(e.target.value)}
        placeholder="Enter Room ID"
        style={{
          padding: "0.6rem 1rem",
          fontSize: "1rem",
          textAlign: "center",
          borderRadius: "25px",
          border: "none",
          width: "250px",
          marginRight: "8px",
        }}
      />
      {room && (
  <button
    onClick={() => navigator.clipboard.writeText(room)}
    title="Copy Room ID"
    style={{
      background: "#2196f3",
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
  );
}
