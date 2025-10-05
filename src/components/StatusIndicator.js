export default function StatusIndicator({ status }) {
  return (
    <div style={{ marginBottom: "1rem", fontSize: "1.1rem" }}>
      {status === "connected" && <span style={{ color: "#4caf50" }}>🟢 Connected</span>}
      {status === "waiting" && <span style={{ color: "#ffeb3b" }}>⏳ Waiting...</span>}
      {status === "disconnected" && <span style={{ color: "#f44336" }}>🔴 Disconnected</span>}
    </div>
  );
}
