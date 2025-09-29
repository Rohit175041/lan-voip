export function createPeerConnection(socket, remoteVideo, stopTimer, setStatus) {
  const peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
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
    stopTimer();
    setStatus("connected");
  };

  return peer;
}
