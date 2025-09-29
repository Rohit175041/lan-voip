export default function TimerProgress({ timeLeft }) {
  return (
    <div style={{ marginTop: "0.5rem", textAlign: "center", width: "250px" }}>
      <div
        style={{
          height: "8px",
          background: "#eee",
          borderRadius: "5px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "8px",
            width: `${(timeLeft / 120) * 100}%`,
            background: "#ff9800",
            transition: "width 1s linear",
          }}
        />
      </div>
      <div style={{ marginTop: "5px", fontSize: "0.9rem", color: "#fff" }}>
        Waiting... {timeLeft}s
      </div>
    </div>
  );
}
