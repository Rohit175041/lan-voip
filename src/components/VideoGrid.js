import React from "react";
import "./VideoGrid.css";

export default function VideoGrid({ localVideo, remoteVideo }) {
  const videos = [
    { ref: localVideo, label: "You" },
    { ref: remoteVideo, label: "Remote" },
  ];

  return (
    <div className="video-grid">
      {videos.map((v, i) => (
        <div key={i} className="video-container">
          <video ref={v.ref} autoPlay muted={v.label === "You"} playsInline />
          <span className="label">{v.label}</span>
        </div>
      ))}
    </div>
  );
}
