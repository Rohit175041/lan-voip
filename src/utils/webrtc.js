export function createPeerConnection(socket, localVideo, remoteVideo, onConnected) {
  const peer = new RTCPeerConnection({
    iceServers: [
      { urls: process.env.REACT_APP_ICE_SERVERS || "stun:stun.l.google.com:19302" },
    ],
  });

  peer.onicecandidate = (e) => {
    if (e.candidate && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ ice: e.candidate }));
    }
  };

  peer.ontrack = (e) => {
    if (remoteVideo.current && e.streams[0]) {
      remoteVideo.current.srcObject = e.streams[0];
    }
    if (onConnected) onConnected();
  };

  return peer;
}

export function cleanupPeerConnection(pc, ws, localVideo, remoteVideo) {
  if (localVideo.current?.srcObject) {
    localVideo.current.srcObject.getTracks().forEach((t) => t.stop());
    localVideo.current.srcObject = null;
  }
  if (remoteVideo.current) remoteVideo.current.srcObject = null;

  pc?.getSenders().forEach((s) => s.track && s.track.stop());
  pc?.close();

  if (ws && ws.readyState === WebSocket.OPEN) ws.close();
}
