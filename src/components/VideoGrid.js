import "./VideoGrid.css";

export default function VideoGrid({ localRef, remoteRef }) {
  const videos = [
    { ref: localRef, label: "You" },
    { ref: remoteRef, label: "Remote" },
  ];

  return (
    <div className="video-grid">
      {videos.map((v, i) => (
        <div key={i} className="video-card">
          <video
            ref={v.ref}
            autoPlay
            muted={v.label === "You"}
            playsInline
            className="video-element"
          />
          <div className="video-label">{v.label}</div>
        </div>
      ))}
    </div>
  );
}