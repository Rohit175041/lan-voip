export default function VideoGrid({ localRef, remoteRef }) {
  const videos = [
    { ref: localRef, label: "You" },
    { ref: remoteRef, label: "Remote" },
  ];

  return (
    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
      {videos.map((v, i) => (
        <div
          key={i}
          style={{
            background: "rgba(0,0,0,0.6)",
            borderRadius: "15px",
            overflow: "hidden",
            width: "300px",
            height: "200px",
            boxShadow: "0 8px 25px rgba(0,0,0,0.4)",
            position: "relative",
          }}
        >
          <video
            ref={v.ref}
            autoPlay
            muted={v.label === "You"}
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "8px",
              right: "8px",
              background: "rgba(0,0,0,0.5)",
              padding: "4px 8px",
              borderRadius: "6px",
              fontSize: "0.8rem",
            }}
          >
            {v.label}
          </div>
        </div>
      ))}
    </div>
  );
}
