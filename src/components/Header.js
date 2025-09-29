import React from "react";
import "./Header.css";

export default function Header() {
  return (
    <div className="header">
      <img
        src="https://img.icons8.com/color/96/video-call.png"
        alt="logo"
        className="logo"
      />
      <h1>WaveRTC</h1>
      <p>Peer-to-peer video chat</p>
    </div>
  );
}
