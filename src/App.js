// // App.js
// import React, { useRef, useState, useEffect } from "react";
// import "./App.css";

// import Header from "./components/Header";
// import StatusIndicator from "./components/StatusIndicator";
// import VideoGrid from "./components/VideoGrid";
// import RoomInput from "./components/RoomInput";
// import TimerProgress from "./components/TimerProgress";
// import ChatBox from "./components/ChatBox";
// import CallButtons from "./components/CallButtons";

// import {
//   createPeerConnection,
//   cleanupPeerConnection,
//   createChatChannel,
// } from "./utils/webrtc";
// import { createWebSocket } from "./utils/signaling";

// export default function App() {
//   const localVideo = useRef(null);
//   const remoteVideo = useRef(null);

//   const [pc, setPc] = useState(null);
//   const [ws, setWs] = useState(null);
//   const [room, setRoom] = useState("");
//   const [timeLeft, setTimeLeft] = useState(null);
//   const timerRef = useRef(null);
//   const [status, setStatus] = useState("disconnected");

//   // Chat state
//   const [messages, setMessages] = useState([]);
//   const [chatChannel, setChatChannel] = useState(null);
//   const [chatInput, setChatInput] = useState("");
//   const [receivingFile, setReceivingFile] = useState(null);

//   // Use refs for queues/flags
//   const pendingMessagesRef = useRef([]);
//   const setPendingMessages = (updater) => {
//     pendingMessagesRef.current =
//       typeof updater === "function"
//         ? updater(pendingMessagesRef.current)
//         : updater;
//   };

//   const isCallerRef = useRef(false);
//   const madeOfferRef = useRef(false);
//   const remoteDescSetRef = useRef(false);
//   const pendingRemoteICERef = useRef([]);

//   // ---- Timer helpers ----
//   const startTimer = (seconds) => {
//     stopTimer();
//     setTimeLeft(seconds);
//     if (status !== "connected") setStatus("waiting");
//     timerRef.current = setInterval(() => {
//       setTimeLeft((prev) => {
//         if (prev <= 1) {
//           stopTimer();
//           alert("No one joined within 2 minutes. Call ended.");
//           disconnect();
//           return 0;
//         }
//         return prev - 1;
//       });
//     }, 1000);
//   };

//   const stopTimer = () => {
//     if (timerRef.current) clearInterval(timerRef.current);
//     timerRef.current = null;
//     setTimeLeft(null);
//   };

//   // ---- Flush queued messages ----
//   const flushQueued = (dc) => {
//     setPendingMessages((queued) => {
//       if (dc && dc.readyState === "open" && queued.length) {
//         try {
//           queued.forEach((m) => dc.send(m));
//           console.log(`✅ Flushed ${queued.length} pending messages`);
//           return [];
//         } catch (err) {
//           console.warn("⚠️ Failed flushing queued messages:", err);
//           return queued;
//         }
//       }
//       return queued;
//     });
//   };

//   // ---- Disconnect ----
//   const disconnect = () => {
//     stopTimer();
//     setStatus("disconnected");
//     try {
//       if (chatChannel && chatChannel.readyState !== "closed") chatChannel.close();
//     } catch (_) {}

//     cleanupPeerConnection(pc, ws, localVideo, remoteVideo);

//     setPc(null);
//     setWs(null);
//     setChatChannel(null);
//     setMessages([]);
//     setReceivingFile(null);

//     isCallerRef.current = false;
//     madeOfferRef.current = false;
//     remoteDescSetRef.current = false;
//     pendingRemoteICERef.current = [];
//   };

//   // ---- Incoming data (chat or file) ----
//   const handleIncomingData = (data) => {
//     if (data instanceof ArrayBuffer) {
//       setReceivingFile((prev) =>
//         prev ? { ...prev, buffers: [...prev.buffers, data] } : prev
//       );
//       return;
//     }

//     if (data instanceof Blob) {
//       data.arrayBuffer().then((buf) =>
//         setReceivingFile((prev) =>
//           prev ? { ...prev, buffers: [...prev.buffers, buf] } : prev
//         )
//       );
//       return;
//     }

//     if (typeof data === "string") {
//       try {
//         const obj = JSON.parse(data);
//         if (obj.fileStart) {
//           setReceivingFile({ name: obj.fileStart, size: obj.size, buffers: [] });
//           return;
//         }
//         if (obj.fileEnd) {
//           setReceivingFile((prev) => {
//             if (!prev) return null;
//             const blob = new Blob(prev.buffers);
//             const url = URL.createObjectURL(blob);
//             setMessages((p) => [
//               ...p,
//               {
//                 sender: "remote",
//                 text: "📁 Received file:",
//                 fileName: prev.name,
//                 fileUrl: url,
//               },
//             ]);
//             return null;
//           });
//           return;
//         }
//       } catch {
//         setMessages((prev) => [...prev, { sender: "remote", text: data }]);
//       }
//     }
//   };

//   // ---- Setup DataChannel ----
//   const setupDataChannel = (dc, label) => {
//     if (!dc) return;
//     dc.binaryType = "arraybuffer";
//     dc.onmessage = (e) => handleIncomingData(e.data);
//     dc.onopen = () => {
//       console.log(`✅ DataChannel open (${label})`);
//       setChatChannel(dc);
//       flushQueued(dc);
//       stopTimer();
//       setStatus("connected");
//     };
//     dc.onclose = () => {
//       console.log(`⚠️ DataChannel closed (${label})`);
//       setChatChannel(null);
//     };
//     dc.onerror = (err) => {
//       console.error(`⚠️ DataChannel error (${label}):`, err);
//       setChatChannel(null);
//     };
//   };

//   // ---- Start Call ----
//   const startCall = async () => {
//     if (!room.trim()) {
//       alert("⚠️ Enter a Room ID first");
//       return;
//     }
//     if (pc || ws) {
//       alert("⚠️ Already in a call. Disconnect first.");
//       return;
//     }

//     const socket = createWebSocket(
//       room,
//       disconnect, // onClose handler from your signaling util
//       async () => {
//         setStatus("waiting");

//         const peer = createPeerConnection(
//           socket,
//           localVideo,
//           remoteVideo,
//           () => {
//             console.log("🎥 Remote track received");
//             stopTimer();
//             setStatus("connected");
//           }
//         );
//         setPc(peer);

//         // Accept remote-created channels
//         peer.ondatachannel = (event) => setupDataChannel(event.channel, "inbound");

//         // Get local media
//         try {
//           const stream = await navigator.mediaDevices.getUserMedia({
//             video: true,
//             audio: true,
//           });
//           if (localVideo.current) localVideo.current.srcObject = stream;
//           stream.getTracks().forEach((t) => peer.addTrack(t, stream));
//         } catch (err) {
//           alert("Camera/Microphone permission denied");
//           socket.close();
//           return;
//         }

//         // ---- Optimistic caller path: create DC + Offer immediately
//         // (works even if your server doesn't send `roomSize`)
//         if (!madeOfferRef.current) {
//           try {
//             const dc = createChatChannel(peer, handleIncomingData);
//             setupDataChannel(dc, "outbound");
//           } catch (e) {
//             console.warn("Could not create outbound DataChannel (will rely on inbound).", e);
//           }

//           try {
//             const offer = await peer.createOffer();
//             await peer.setLocalDescription(offer);
//             socket.send(JSON.stringify({ sdp: peer.localDescription }));
//             madeOfferRef.current = true;
//             isCallerRef.current = true;
//           } catch (err) {
//             console.error("❌ Failed to create/send initial offer:", err);
//           }
//         }

//         // ---- Signaling
//         socket.onmessage = async (event) => {
//           let data = null;
//           try {
//             data = JSON.parse(event.data);
//           } catch (err) {
//             console.warn("Bad signaling payload:", err);
//             return;
//           }

//           if (data.sdp) {
//             const desc = new RTCSessionDescription(data.sdp);
//             try {
//               if (desc.type === "offer") {
//                 // Handle glare: if not stable, rollback our local offer first
//                 if (peer.signalingState !== "stable") {
//                   try {
//                     await peer.setLocalDescription({ type: "rollback" });
//                   } catch (e) {
//                     console.warn("Rollback failed (continuing):", e);
//                   }
//                 }
//                 await peer.setRemoteDescription(desc);
//                 remoteDescSetRef.current = true;

//                 // Apply queued ICE now that remote desc is set
//                 const queued = pendingRemoteICERef.current;
//                 pendingRemoteICERef.current = [];
//                 for (const ice of queued) {
//                   try {
//                     await peer.addIceCandidate(new RTCIceCandidate(ice));
//                   } catch (e) {
//                     console.warn("⚠️ queued addIceCandidate failed:", e);
//                   }
//                 }

//                 const answer = await peer.createAnswer();
//                 await peer.setLocalDescription(answer);
//                 socket.send(JSON.stringify({ sdp: peer.localDescription }));
//                 stopTimer();
//                 setStatus("connected");
//               } else if (desc.type === "answer") {
//                 await peer.setRemoteDescription(desc);
//                 remoteDescSetRef.current = true;

//                 const queued = pendingRemoteICERef.current;
//                 pendingRemoteICERef.current = [];
//                 for (const ice of queued) {
//                   try {
//                     await peer.addIceCandidate(new RTCIceCandidate(ice));
//                   } catch (e) {
//                     console.warn("⚠️ queued addIceCandidate failed:", e);
//                   }
//                 }
//                 stopTimer();
//                 setStatus("connected");
//               }
//             } catch (err) {
//               console.error("Error applying SDP:", err);
//             }
//           } else if (data.ice) {
//             if (!remoteDescSetRef.current) {
//               pendingRemoteICERef.current.push(data.ice);
//             } else {
//               try {
//                 await peer.addIceCandidate(new RTCIceCandidate(data.ice));
//               } catch (err) {
//                 console.warn("⚠️ addIceCandidate failed:", err);
//               }
//             }
//           } else if (data.type === "roomSize") {
//             // Optional: still support your server's roomSize hint
//             if (data.count >= 2 && !madeOfferRef.current) {
//               try {
//                 const dc = createChatChannel(peer, handleIncomingData);
//                 setupDataChannel(dc, "outbound");
//               } catch (_) {}
//               try {
//                 const offer = await peer.createOffer();
//                 await peer.setLocalDescription(offer);
//                 socket.send(JSON.stringify({ sdp: peer.localDescription }));
//                 madeOfferRef.current = true;
//                 isCallerRef.current = true;
//                 stopTimer();
//                 setStatus("connected");
//               } catch (err) {
//                 console.error("❌ Failed to create/send offer (roomSize path):", err);
//               }
//             } else if (data.count < 2) {
//               startTimer(120);
//             }
//           } else if (data.type === "timeout") {
//             alert(data.message || "Call ended due to inactivity.");
//             disconnect();
//           }
//         };

//         socket.onclose = () => {
//           console.warn("⚠️ WebSocket closed");
//           setStatus("disconnected");
//           setChatChannel(null);
//         };

//         startTimer(120);
//       }
//     );

//     setWs(socket);
//   };

//   // ---- Send text ----
//   const sendMessage = () => {
//     if (!chatInput.trim()) return;
//     setMessages((prev) => [...prev, { sender: "me", text: chatInput }]);

//     if (chatChannel && chatChannel.readyState === "open") {
//       try {
//         chatChannel.send(chatInput);
//       } catch (err) {
//         setPendingMessages((prev) => [...prev, chatInput]);
//       }
//     } else {
//       setPendingMessages((prev) => [...prev, chatInput]);
//     }
//     setChatInput("");
//   };

//   // ---- Send file ----
//   const sendFile = (file) => {
//     if (!file) return;
//     if (!chatChannel || chatChannel.readyState !== "open") {
//       alert("Chat channel not open");
//       return;
//     }
//     if (file.size > 50 * 1024 * 1024) {
//       alert("File is too large (max 50 MB).");
//       return;
//     }

//     const chunkSize = 16 * 1024;
//     const reader = new FileReader();
//     let offset = 0;

//     const readSlice = (o) => {
//       const slice = file.slice(o, o + chunkSize);
//       reader.readAsArrayBuffer(slice);
//     };

//     reader.onload = (e) => {
//       chatChannel.send(e.target.result);
//       offset += e.target.result.byteLength;
//       if (offset < file.size) readSlice(offset);
//       else chatChannel.send(JSON.stringify({ fileEnd: file.name }));
//     };

//     chatChannel.send(JSON.stringify({ fileStart: file.name, size: file.size }));
//     readSlice(0);

//     const fileUrl = URL.createObjectURL(file);
//     setMessages((prev) => [
//       ...prev,
//       { sender: "me", text: "📁 Sent file:", fileName: file.name, fileUrl },
//     ]);
//   };

//   useEffect(() => {
//     return () => {
//       try {
//         disconnect();
//       } catch (_) {}
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   // ---- UI ----
//   return (
//     <div className="app-container">
//       <div className="card-wrapper">
//         <Header />
//         <div className="call-card">
//           <div className="status-wrapper">
//             <StatusIndicator status={status} />
//           </div>

//           <VideoGrid localRef={localVideo} remoteRef={remoteVideo} />
//           {status !== "connected" && <RoomInput room={room} setRoom={setRoom} />}
//           {timeLeft !== null && <TimerProgress timeLeft={timeLeft} />}
//           <ChatBox
//             status={status}
//             messages={messages}
//             chatInput={chatInput}
//             setChatInput={setChatInput}
//             sendMessage={sendMessage}
//             sendFile={sendFile}
//             receivingFile={receivingFile}
//           />

//           <CallButtons
//             onStart={startCall}
//             onDisconnect={disconnect}
//             disabled={!!pc || !!ws}
//           />
//         </div>
//       </div>
//     </div>
//   );
// }

// App.js
import React, { useRef, useState, useEffect } from "react";
import "./App.css";

import Header from "./components/Header";
import StatusIndicator from "./components/StatusIndicator";
import VideoGrid from "./components/VideoGrid";
import RoomInput from "./components/RoomInput";
import TimerProgress from "./components/TimerProgress";
import ChatBox from "./components/ChatBox";
import CallButtons from "./components/CallButtons";

import {
  createPeerConnection,
  cleanupPeerConnection,
  createChatChannel,
} from "./utils/webrtc";
import { createWebSocket } from "./utils/signaling";

export default function App() {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  const [pc, setPc] = useState(null);
  const [ws, setWs] = useState(null);
  const [room, setRoom] = useState("");
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);
  const [status, setStatus] = useState("disconnected");

  // Chat state
  const [messages, setMessages] = useState([]);
  const [chatChannel, setChatChannel] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [receivingFile, setReceivingFile] = useState(null);

  // Queued messages (persist across reconnect)
  const pendingMessagesRef = useRef([]);
  const setPendingMessages = (updater) => {
    pendingMessagesRef.current =
      typeof updater === "function"
        ? updater(pendingMessagesRef.current)
        : updater;
  };

  // Signaling/ICE guards
  const isCallerRef = useRef(false);
  const madeOfferRef = useRef(false);
  const remoteDescSetRef = useRef(false);
  const pendingRemoteICERef = useRef([]);
  const startedRef = useRef(false); // <-- prevents double init when WS open fires twice

  // ---- Timer helpers ----
  const startTimer = (seconds) => {
    stopTimer();
    setTimeLeft(seconds);
    if (status !== "connected") setStatus("waiting");
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopTimer();
          alert("No one joined within 2 minutes. Call ended.");
          disconnect();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setTimeLeft(null);
  };

  // ---- Flush queued messages ----
  const flushQueued = (dc) => {
    setPendingMessages((queued) => {
      if (dc && dc.readyState === "open" && queued.length) {
        try {
          queued.forEach((m) => dc.send(m));
          console.log(`✅ Flushed ${queued.length} pending messages`);
          return [];
        } catch (err) {
          console.warn("⚠️ Failed flushing queued messages:", err);
          return queued;
        }
      }
      return queued;
    });
  };

  // ---- Disconnect ----
  const disconnect = () => {
    stopTimer();
    setStatus("disconnected");
    try {
      if (chatChannel && chatChannel.readyState !== "closed") chatChannel.close();
    } catch (_) {}

    cleanupPeerConnection(pc, ws, localVideo, remoteVideo);

    setPc(null);
    setWs(null);
    setChatChannel(null);
    setMessages([]);
    setReceivingFile(null);

    isCallerRef.current = false;
    madeOfferRef.current = false;
    remoteDescSetRef.current = false;
    pendingRemoteICERef.current = [];
    startedRef.current = false; // allow a future start
  };

  // ---- Incoming data (chat or file) ----
  const handleIncomingData = (data) => {
    if (data instanceof ArrayBuffer) {
      setReceivingFile((prev) =>
        prev ? { ...prev, buffers: [...prev.buffers, data] } : prev
      );
      return;
    }

    if (data instanceof Blob) {
      data.arrayBuffer().then((buf) =>
        setReceivingFile((prev) =>
          prev ? { ...prev, buffers: [...prev.buffers, buf] } : prev
        )
      );
      return;
    }

    if (typeof data === "string") {
      try {
        const obj = JSON.parse(data);
        if (obj.fileStart) {
          setReceivingFile({ name: obj.fileStart, size: obj.size, buffers: [] });
          return;
        }
        if (obj.fileEnd) {
          setReceivingFile((prev) => {
            if (!prev) return null;
            const blob = new Blob(prev.buffers);
            const url = URL.createObjectURL(blob);
            setMessages((p) => [
              ...p,
              {
                sender: "remote",
                text: "📁 Received file:",
                fileName: prev.name,
                fileUrl: url,
              },
            ]);
            return null;
          });
          return;
        }
      } catch {
        setMessages((prev) => [...prev, { sender: "remote", text: data }]);
      }
    }
  };

  // ---- Setup DataChannel ----
  const setupDataChannel = (dc, label) => {
    if (!dc) return;
    dc.binaryType = "arraybuffer";
    dc.onmessage = (e) => handleIncomingData(e.data);
    dc.onopen = () => {
      console.log(`✅ DataChannel open (${label})`);
      setChatChannel(dc);
      flushQueued(dc);
      stopTimer();
      setStatus("connected");
    };
    dc.onclose = () => {
      console.log(`⚠️ DataChannel closed (${label})`);
      setChatChannel(null);
    };
    dc.onerror = (err) => {
      console.error(`⚠️ DataChannel error (${label}):`, err);
      setChatChannel(null);
    };
  };

  // ---- Start Call ----
  const startCall = async () => {
    if (!room.trim()) {
      alert("⚠️ Enter a Room ID first");
      return;
    }
    if (pc || ws) {
      alert("⚠️ Already in a call. Disconnect first.");
      return;
    }

    // init function runs once when WS is open
    const initAfterWsOpen = async () => {
      if (startedRef.current) return; // prevent double-run
      startedRef.current = true;

      setStatus("waiting");

      const peer = createPeerConnection(
        socket,
        localVideo,
        remoteVideo,
        () => {
          console.log("🎥 Remote track received");
          stopTimer();
          setStatus("connected");
        }
      );

      // Helpful ICE/peer logs (diagnostics)
      peer.oniceconnectionstatechange = () =>
        console.log("🌐 ICE state:", peer.iceConnectionState);
      peer.onconnectionstatechange = () =>
        console.log("🔌 Peer state:", peer.connectionState);

      setPc(peer);

      // Accept remote-created channels
      peer.ondatachannel = (event) => setupDataChannel(event.channel, "inbound");

      // Get local media
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (localVideo.current) localVideo.current.srcObject = stream;
        stream.getTracks().forEach((t) => peer.addTrack(t, stream));
      } catch (err) {
        alert("Camera/Microphone permission denied");
        socket.close();
        return;
      }

      // Create our outbound DC + initial offer immediately (no server hint needed)
      if (!madeOfferRef.current) {
        try {
          const dc = createChatChannel(peer, handleIncomingData);
          setupDataChannel(dc, "outbound");
        } catch (e) {
          console.warn("Could not create outbound DataChannel; will rely on inbound.", e);
        }

        try {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          socket.send(JSON.stringify({ sdp: peer.localDescription }));
          madeOfferRef.current = true;
          isCallerRef.current = true;
        } catch (err) {
          console.error("❌ Failed to create/send initial offer:", err);
        }
      }

      // ---- Signaling
      socket.onmessage = async (event) => {
        let data = null;
        try {
          data = JSON.parse(event.data);
        } catch (err) {
          console.warn("Bad signaling payload:", err);
          return;
        }

        if (data.sdp) {
          const desc = new RTCSessionDescription(data.sdp);
          try {
            if (desc.type === "offer") {
              // Handle glare: if not stable, rollback our local offer first
              if (peer.signalingState !== "stable") {
                try {
                  await peer.setLocalDescription({ type: "rollback" });
                } catch (e) {
                  console.warn("Rollback failed (continuing):", e);
                }
              }
              await peer.setRemoteDescription(desc);
              remoteDescSetRef.current = true;

              // Apply queued ICE now that remote desc is set
              const queued = pendingRemoteICERef.current;
              pendingRemoteICERef.current = [];
              for (const ice of queued) {
                try {
                  await peer.addIceCandidate(new RTCIceCandidate(ice));
                } catch (e) {
                  console.warn("⚠️ queued addIceCandidate failed:", e);
                }
              }

              const answer = await peer.createAnswer();
              await peer.setLocalDescription(answer);
              socket.send(JSON.stringify({ sdp: peer.localDescription }));
              stopTimer();
              setStatus("connected");
            } else if (desc.type === "answer") {
              await peer.setRemoteDescription(desc);
              remoteDescSetRef.current = true;

              const queued = pendingRemoteICERef.current;
              pendingRemoteICERef.current = [];
              for (const ice of queued) {
                try {
                  await peer.addIceCandidate(new RTCIceCandidate(ice));
                } catch (e) {
                  console.warn("⚠️ queued addIceCandidate failed:", e);
                }
              }
              stopTimer();
              setStatus("connected");
            }
          } catch (err) {
            console.error("Error applying SDP:", err);
          }
        } else if (data.ice) {
          if (!remoteDescSetRef.current) {
            pendingRemoteICERef.current.push(data.ice);
          } else {
            try {
              await peer.addIceCandidate(new RTCIceCandidate(data.ice));
            } catch (err) {
              console.warn("⚠️ addIceCandidate failed:", err);
            }
          }
        } else if (data.type === "roomSize") {
          // Optional: still support the roomSize hint
          if (data.count >= 2 && !madeOfferRef.current) {
            try {
              const dc = createChatChannel(peer, handleIncomingData);
              setupDataChannel(dc, "outbound");
            } catch (_) {}
            try {
              const offer = await peer.createOffer();
              await peer.setLocalDescription(offer);
              socket.send(JSON.stringify({ sdp: peer.localDescription }));
              madeOfferRef.current = true;
              isCallerRef.current = true;
              stopTimer();
              setStatus("connected");
            } catch (err) {
              console.error("❌ Failed to create/send offer (roomSize path):", err);
            }
          } else if (data.count < 2) {
            startTimer(120);
          }
        } else if (data.type === "timeout") {
          alert(data.message || "Call ended due to inactivity.");
          disconnect();
        }
      };

      // If the WS closes later, reflect that in UI
      socket.onclose = () => {
        console.warn("⚠️ WebSocket closed");
        setStatus("disconnected");
        setChatChannel(null);
      };

      startTimer(120);
    };

    // Create WS and run init when it actually opens
    const socket = createWebSocket(room, disconnect, initAfterWsOpen);
    setWs(socket);

    // ---- Defensive fallback (in case signaling.js didn't call onOpen)
    if (socket.readyState === WebSocket.OPEN) {
      initAfterWsOpen();
    } else {
      // will run only once
      socket.addEventListener("open", initAfterWsOpen, { once: true });
    }
  };

  // ---- Send text ----
  const sendMessage = () => {
    if (!chatInput.trim()) return;
    setMessages((prev) => [...prev, { sender: "me", text: chatInput }]);

    if (chatChannel && chatChannel.readyState === "open") {
      try {
        chatChannel.send(chatInput);
      } catch (err) {
        setPendingMessages((prev) => [...prev, chatInput]);
      }
    } else {
      setPendingMessages((prev) => [...prev, chatInput]);
    }
    setChatInput("");
  };

  // ---- Send file ----
  const sendFile = (file) => {
    if (!file) return;
    if (!chatChannel || chatChannel.readyState !== "open") {
      alert("Chat channel not open");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      alert("File is too large (max 50 MB).");
      return;
    }

    const chunkSize = 16 * 1024;
    const reader = new FileReader();
    let offset = 0;

    const readSlice = (o) => {
      const slice = file.slice(o, o + chunkSize);
      reader.readAsArrayBuffer(slice);
    };

    reader.onload = (e) => {
      chatChannel.send(e.target.result);
      offset += e.target.result.byteLength;
      if (offset < file.size) readSlice(offset);
      else chatChannel.send(JSON.stringify({ fileEnd: file.name }));
    };

    chatChannel.send(JSON.stringify({ fileStart: file.name, size: file.size }));
    readSlice(0);

    const fileUrl = URL.createObjectURL(file);
    setMessages((prev) => [
      ...prev,
      { sender: "me", text: "📁 Sent file:", fileName: file.name, fileUrl },
    ]);
  };

  useEffect(() => {
    return () => {
      try {
        disconnect();
      } catch (_) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- UI ----
  return (
    <div className="app-container">
      <div className="card-wrapper">
        <Header />
        <div className="call-card">
          <div className="status-wrapper">
            <StatusIndicator status={status} />
          </div>

          <VideoGrid localRef={localVideo} remoteRef={remoteVideo} />
          {status !== "connected" && <RoomInput room={room} setRoom={setRoom} />}
          {timeLeft !== null && <TimerProgress timeLeft={timeLeft} />}
          <ChatBox
            status={status}
            messages={messages}
            chatInput={chatInput}
            setChatInput={setChatInput}
            sendMessage={sendMessage}
            sendFile={sendFile}
            receivingFile={receivingFile}
          />

          <CallButtons
            onStart={startCall}
            onDisconnect={disconnect}
            disabled={!!pc || !!ws}
          />
        </div>
      </div>
    </div>
  );
}
