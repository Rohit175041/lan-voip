import "./StatusIndicator.css";

export default function StatusIndicator({ status }) {
  const labels = {
    connected: "Connected",
    waiting: "Waiting for peer",
    reconnecting: "Reconnecting",
    disconnected: "Disconnected",
  };

  return (
    <div className={`status-pill ${status}`}>
      <span className="status-dot" />
      <span>{labels[status] || "Unknown status"}</span>
    </div>
  );
}
