//TODO: Check types for production
//@ts-nocheck 

import React, { useState, useRef, useEffect } from 'react';

export default function MultiUserChat() {
  const [roomId, setRoomId] = useState('');
  const [joinedRoom, setJoinedRoom] = useState(false);
  const [clientId, setClientId] = useState(null);

  const localVideoRef = useRef(null);   // ref to the <video> obj
  const localStreamRef = useRef(null);  // ref to media <MediaStream> obj (camera + mic)

  // Map of peerId -> RTCPeerConnection
  // const [peerConnections, setPeerConnections] = useState({});
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});

  // Map of peerId -> MediaStream object
  const [remoteStreams, setRemoteStreams] = useState({});

  // List of peerIds (for rendering)
  const [peerIds, setPeerIds] = useState([]);

  const wsRef = useRef(null);  // ref to websocket connection -> exchange signaling messages (offers, answers, ICE candidates)

  // --- ICE servers for STUN/TURN ---
  const ICE_SERVERS = [
    { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
    // For production, add TURN servers too
  ];

  // Get user media once (camera + mic)
  const startLocalStream = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
  };

  useEffect(() => {
    // Start camera/mic on mount -> not restart when re-rendered
    
    startLocalStream();
  }, []);

  // useEffect(() => {
  //   console.log('Peer connections: ', peerConnections);
  // }, [peerConnections]);

  const addPeerConnection = (peerId: string, pc: RTCPeerConnection) => {
    peerConnectionsRef.current[peerId] = pc;
    // if you still need state to trigger a render, you can keep a list of ids:
    setPeerIds(Object.keys(peerConnectionsRef.current));
    // console.log('Peer connections at addPeerConnection:', { ...peerConnectionsRef.current });
  };

  const removePeerConnection = (peerId: string) => {
    delete peerConnectionsRef.current[peerId];
    setPeerIds(Object.keys(peerConnectionsRef.current));
  };

  // Helper: create a new RTCPeerConnection for a given peerId
  // and add local tracks + set up event listeners.
  const createPeerConnection = (peerId) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // When the PC gets a remote track, store it in state
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setRemoteStreams((prev) => ({
        ...prev,
        [peerId]: remoteStream
      }));
    };

    // Send any ICE candidates to the peer via the signaling server
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage({
          type: 'ice-candidate',
          target: peerId,
          candidate: event.candidate
        });
      }
    };

    return pc;
  };

  // Send JSON over WebSocket
  const sendMessage = (msg) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  };

  // Handle incoming messages from signaling server
  const handleMessage = async (msg) => {
    const data = JSON.parse(msg.data);

    switch (data.type) {
      case 'new-peer': {
        const newPeerId = data.clientId;
        // The server also sends "roomClients": list of all known clients in the room
        // so you could optionally handle them. For now, we only handle the newly joined peer.

        // If it's us, ignore
        if (newPeerId === clientId) return;

        // Create a new peer connection
        const pc = createPeerConnection(newPeerId);
        console.log('In new-peer', newPeerId, 'Connection created');

        // Insert into local state
        // setPeerConnections((prev) => ({ ...prev, [newPeerId]: pc }));
        addPeerConnection(newPeerId, pc);
        // console.log('Peer connections at new-peer handling:', { ...peerConnections });

        // Create an offer for the new peer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Send the offer to that new peer
        sendMessage({
          type: 'offer',
          target: newPeerId,
          offer
        });

        break;
      }

      case 'offer': {
        const fromId = data.from;
        const { offer } = data;

        console.log('Received offer from peer', data);

        // If we don’t already have a connection to this peer, create it
        // let pc = peerConnections[fromId];
        // console.log('Peer connections at offer handling:', { ...peerConnections });
        let pc = peerConnectionsRef.current[fromId]
        if (!pc) {
          pc = createPeerConnection(fromId);
          addPeerConnection(fromId, pc);
          // await setPeerConnections((prev) => ({ ...prev, [fromId]: pc }));
        }
        
        await pc.setRemoteDescription(offer);

        // Create an answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // Send back answer
        sendMessage({
          type: 'answer',
          target: fromId,
          answer
        });
        break;
      }

      case 'answer': {
        console.log('Received answer from peer', data);
        const fromId = data.from;
        const { answer } = data;
        // const pc = peerConnections[fromId];
        const pc = peerConnectionsRef.current[fromId];
        console.log('Data: ', data)
        // console.log('Peer connections at answer handling:', { ...peerConnections });
        if (!pc) {
          console.log('No peer connection for answer', fromId);
          return;
        }
        console.log('Set remote description for peer', fromId);
        await pc.setRemoteDescription(answer);
        console.log('Set remote description for peer', fromId);
        console.log('Received answer from peer', fromId);
        break;
      }

      case 'ice-candidate': {
        const fromId = data.from;
        const { candidate } = data;
        // const pc = peerConnections[fromId];
        const pc = peerConnectionsRef.current[fromId];
        if (!pc || !candidate) return;
        try {
          console.log('Adding ICE candidate', candidate);
          await pc.addIceCandidate(candidate);
        } catch (err) {
          console.error('Error adding received ICE candidate', err);
        }
        break;
      }

      case 'peer-left': {
        const departedId = data.clientId;
        // Close and remove that peer’s connection
        // const pc = peerConnections[departedId];
        const pc = peerConnectionsRef.current[departedId];
        if (pc) {
          pc.close();
		}

		// Remove from PeerConnectionsRef
		removePeerConnection(departedId);

		// Remove from remote streams
        setRemoteStreams((prev) => {
          const newMap = { ...prev };
          delete newMap[departedId];
          return newMap;
        });

        break;
      }

      default:
        break;
    }
  };

  // Join the room: open WebSocket, wait for "clientId"
  const joinRoom = async () => {
    if (!roomId) return;
    setJoinedRoom(true);
  
    const ws = new WebSocket(`ws://localhost:3000/ws/${roomId}`);
    // const ws = new WebSocket(`wss://yolosmarthomeapi.ticklab.site/ws/${roomId}`); // Use wss for secure connection
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (evt) => {
      // On first message of "new-peer" or so, we might realize who we are.
      // Actually, in our server code, we do not explicitly send "your clientId"
      // so we rely on the first time we see "new-peer" with some ID that is not in our list,
      // we might guess we have not set ours yet. For a more robust approach, you can modify
      // the server to send `type: "welcome", clientId: X`.
      handleMessage(evt);
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
    };
  };



  return (
    <div style={{ padding: 20 }}>
      <h1>Multi-User Video Chat (Mesh)</h1>

      {!joinedRoom && (
        <div>
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Enter room ID"
          />
          <button onClick={joinRoom}>Join Room</button>
        </div>
      )}

      {joinedRoom && (
        <div>
          <p>Room ID: {roomId}</p>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            style={{ width: '300px', background: 'black' }}
          />
          <h3>Remote Streams:</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {Object.entries(remoteStreams).map(([peerId, stream]) => (
                <VideoPlayer stream={stream} peerId={peerId} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

