import "./StatusIndicator.css";
import { FaCheckCircle, FaClock, FaTimesCircle } from "react-icons/fa";

export default function StatusIndicator({ status }) {
  return (
    <div className="status-indicator">
      {status === "connected" && (
        <span className="status-pill glass connected">
          <FaCheckCircle className="status-icon" /> Connected
        </span>
      )}
      {status === "waiting" && (
        <span className="status-pill glass waiting">
          <FaClock className="status-icon" /> Waiting...
        </span>
      )}
      {status === "disconnected" && (
        <span className="status-pill glass disconnected">
          <FaTimesCircle className="status-icon" /> Disconnected
        </span>
      )}
    </div>
  );
}
