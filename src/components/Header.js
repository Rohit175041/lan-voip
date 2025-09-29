export default function Header() {
  return (
    <div style={{ textAlign: "center", marginBottom: "1rem" }}>
      <img
        src="https://img.icons8.com/color/96/video-call.png"
        alt="logo"
        style={{ height: "60px" }}
      />
      {/* <h1 style={{ margin: "0.5rem 0", fontSize: "2rem" }}>WaveRTC</h1> */}
      <p style={{ margin: 0, fontSize: "1rem", color: "#ddd" }}>
        Peer-to-peer video chat
      </p>
    </div>
  );
}
