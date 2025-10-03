import "./VideoGrid.css";

export default function VideoGrid({ localRef, remoteRef }) {
  return (
    <div className="video-grid">
      <div className="video-card">
        {/* 👇 add className local-mirror */}
        <video
          ref={localRef}
          autoPlay
          muted
          playsInline
          className="video-element local-mirror"
        />
        <div className="video-label">You</div>
      </div>

      <div className="video-card">
        <video
          ref={remoteRef}
          autoPlay
          playsInline
          className="video-element"
        />
        <div className="video-label">Remote</div>
      </div>
    </div>
  );
}
