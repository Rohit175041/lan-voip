// CallButtons.js
import React from "react";
import { FaPhone, FaPhoneSlash } from "react-icons/fa";
import "./CallButtons.css";  

export default function CallButtons({ onStart, onDisconnect, disabled }) {
  return (
    <div className="button-group">
      <button
        onClick={onStart}
        disabled={disabled}
        className={`btn ${disabled ? "btn-disabled" : "btn-green"}`}
      >
        <FaPhone /> Start Call
      </button>

      <button onClick={onDisconnect} className="btn btn-red">
        <FaPhoneSlash /> Disconnect
      </button>
    </div>
  );
}
