import React from "react";
import "./StatusIndicator.css";

export default function StatusIndicator({ status }) {
  return (
    <div className={`status ${status}`}>
      {status === "connected" && "🟢 Connected"}
      {status === "waiting" && "⏳ Waiting..."}
      {status === "disconnected" && "🔴 Disconnected"}
    </div>
  );
}
