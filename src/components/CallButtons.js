// CallButtons.js
import React from "react";
import { FaPhone, FaPhoneSlash } from "react-icons/fa";
import "./CallButtons.css";  

export default function CallButtons({
  onStart,
  onDisconnect,
  startDisabled,
  disconnectDisabled,
}) {
  return (
    <div className="button-group">
      <button
        onClick={onStart}
        disabled={startDisabled}
        className={`btn ${startDisabled ? "btn-disabled" : "btn-green"}`}
      >
        <FaPhone /> Connect
      </button>

      <button
        onClick={onDisconnect}
        disabled={disconnectDisabled}
        className={`btn ${disconnectDisabled ? "btn-disabled" : "btn-red"}`}
      >
        <FaPhoneSlash /> Disconnect
      </button>
    </div>
  );
}
