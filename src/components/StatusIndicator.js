import "./StatusIndicator.css";

export default function StatusIndicator({ status }) {
  return <div className={`status-ball ${status}`} />;
}
