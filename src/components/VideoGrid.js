import {
  FaVideo,
  FaVideoSlash,
  FaMicrophone,
  FaMicrophoneSlash,
} from "react-icons/fa";
import "./VideoGrid.css";

export default function VideoGrid({
  localRef,
  remoteRef,
  isCameraOn,
  isMicOn,
  onToggleCamera,
  onToggleMic,
}) {
  return (
    <div className="video-grid">
      <div className="video-card">
        <video
          ref={localRef}
          autoPlay
          muted
          playsInline
          className="video-element local-mirror"
        />
        <div className="video-label">You</div>
        <div className="video-controls">
          <button
            type="button"
            onClick={onToggleMic}
            className={`video-control-btn ${isMicOn ? "" : "off"}`}
            title={isMicOn ? "Turn mic off" : "Turn mic on"}
            aria-label={isMicOn ? "Turn mic off" : "Turn mic on"}
          >
            {isMicOn ? <FaMicrophone /> : <FaMicrophoneSlash />}
          </button>
          <button
            type="button"
            onClick={onToggleCamera}
            className={`video-control-btn ${isCameraOn ? "" : "off"}`}
            title={isCameraOn ? "Turn camera off" : "Turn camera on"}
            aria-label={isCameraOn ? "Turn camera off" : "Turn camera on"}
          >
            {isCameraOn ? <FaVideo /> : <FaVideoSlash />}
          </button>
        </div>
        {!isCameraOn && (
          <div className="video-off-overlay">
            <FaVideoSlash />
            <span>Camera is off</span>
          </div>
        )}
      </div>

      <div className="video-card">
        <video ref={remoteRef} autoPlay playsInline className="video-element" />
        <div className="video-label">Remote</div>
      </div>
    </div>
  );
}
