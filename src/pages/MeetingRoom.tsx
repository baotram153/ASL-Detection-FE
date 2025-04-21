"use client"
//@ts-nocheck

import { useState, useRef, useEffect } from "react"
import {
  Home,
  Calendar,
  Video,
  Settings,
  LogOut,
  Search,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Phone,
  Share2,
  MoreVertical,
  Plus,
  Send,
} from "lucide-react"

import { NavItem } from "../components/NavItem"
import { VideoThumbnail } from "../components/VideoThumbnail"
import { VideoPlayer } from "../components/VideoPlayer"

export default function VideoMeeting() {
  // get roomId and meetingTitle from URL params
  const urlParams = new URLSearchParams(window.location.search)
  const roomId = urlParams.get("roomId")
  const meetingTitle = urlParams.get("meetingTitle") || "Meeting Title"

  const [clientId, setClientId] = useState(null)
  const [showChat, setShowChat] = useState(true)
  const [chatMessage, setChatMessage] = useState("")
  const [chatMessages, setChatMessages] = useState([
    { id: 1, sender: "Manuela Faiza", content: "I got your score behind me hahahaha!", time: "10m" },
    { id: 2, sender: "Andres Chan", content: "Nimshi-gan!", time: "1min" },
  ])
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [participants, setParticipants] = useState([
    {
      id: 1,
      name: "Ledy Sintia",
      isHost: true,
      isMuted: false,
      isVideoOn: true,
      avatar: "/placeholder.svg?height=50&width=50",
    },
    { id: 2, name: "Rachel Saigotik", isMuted: false, isVideoOn: true, avatar: "/placeholder.svg?height=50&width=50" },
    { id: 3, name: "Jonathan Girl", isMuted: true, isVideoOn: false, avatar: "/placeholder.svg?height=50&width=50" },
    { id: 4, name: "Riska Zaitun", isMuted: true, isVideoOn: false, avatar: "/placeholder.svg?height=50&width=50" },
  ])
  const [currentTime, setCurrentTime] = useState("")

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream>(null)
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({})
  const pendingCandidates = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})
  // const remoteStreams = useRef<Record<string, MediaStream>>({})
  const [peerIds, setPeerIds] = useState<string[]>([])
  const wsRef = useRef<WebSocket>(null)
  const initializedRef = useRef(false);

  // ICE servers for STUN/TURN
  const ICE_SERVERS = [{ urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] }]

  useEffect(() => {
    // Update current time
    const updateTime = () => {
      const now = new Date()
      const hours = now.getHours()
      const minutes = now.getMinutes().toString().padStart(2, "0")
      const ampm = hours >= 12 ? "PM" : "AM"
      const formattedHours = hours % 12 || 12

      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

      const dayName = dayNames[now.getDay()]
      const monthName = monthNames[now.getMonth()]
      const date = now.getDate()
      const year = now.getFullYear()

      setCurrentTime(`${formattedHours}:${minutes} ${dayName} ${monthName} ${date} ${year}`)
    }

    updateTime()
    const interval = setInterval(updateTime, 60000) // Update every minute

    // For development/demo, just simulate joining
    // In production, uncomment the WebSocket connection
    return () => clearInterval(interval)}, []
)

  useEffect(() => {
    if (initializedRef.current) return;  // skip on remount
    initializedRef.current = true;
    
    const init = async () => {
      
      if (wsRef.current) return;

      // Start camera/mic on mount
      await startLocalStream()

      const ws = new WebSocket(`wss://aslmeetingapi.ticklab.site/ws/${roomId}`)
      // const ws = new WebSocket(`wss://yolosmarthomeapi.ticklab.site/ws/${roomId}`);
      // const ws = new WebSocket(`ws://localhost:3000/ws/${roomId}`)

      wsRef.current = ws;
      console.log("WebSocket created")
      console.log(wsRef.current)

      ws.onopen = () => {
        console.log('WebSocket connected');
      };

      ws.onmessage = (evt) => {
        handleMessage(evt);
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
      };
    }

    init();

    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [])

  // Get user media once (camera + mic)
  const startLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      localStreamRef.current = stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
    } catch (error) {
      console.error("Error accessing media devices:", error)
    }
  }

  const addPeerConnection = (peerId: string, pc: RTCPeerConnection) => {
    peerConnectionsRef.current[peerId] = pc
    setPeerIds(Object.keys(peerConnectionsRef.current))
  }

  const removePeerConnection = (peerId: string) => {
    delete peerConnectionsRef.current[peerId]
    setPeerIds(Object.keys(peerConnectionsRef.current))
  }

  // Helper: create a new RTCPeerConnection for a given peerId
  const createPeerConnection = (peerId: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    // When the PC gets a remote track, store it in state
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams
      setRemoteStreams((prev) => ({
        ...prev,
        [peerId]: remoteStream,
      }))
      // remoteStreams.current[peerId] = remoteStream
      console.log("Remote stream added:", peerId, remoteStream)
    }

    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!)
      })
    }

    // Send any ICE candidates to the peer via the signaling server
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage({
          type: "ice-candidate",
          target: peerId,
          candidate: event.candidate,
        })
      }
    }

    return pc
  }

  // Send JSON over WebSocket
  const sendMessage = (msg: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }


  // Handle incoming messages from signaling server
  const handleMessage = async (msg: any) => {
    const data = JSON.parse(msg.data)

    switch (data.type) {
      case "new-peer": {
        console.log("New peer joined:", data.clientId)
        const newPeerId = data.clientId
        if (newPeerId === clientId) return

        const pc = createPeerConnection(newPeerId)
        addPeerConnection(newPeerId, pc)

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        sendMessage({
          type: "offer",
          target: newPeerId,
          offer,
        })
        break
      }

      case "offer": {
        console.log("Offer received from peer:", data.from)
        const fromId = data.from
        const { offer } = data

        let pc = peerConnectionsRef.current[fromId]
        if (!pc) {
          pc = createPeerConnection(fromId)
          addPeerConnection(fromId, pc)
        }

        await pc.setRemoteDescription(offer)

        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        sendMessage({
          type: "answer",
          target: fromId,
          answer,
        })
        break
      }

      case "answer": {
        console.log("Answer received from peer:", data.from)
        const fromId = data.from
        const { answer } = data
        const pc = peerConnectionsRef.current[fromId]

        if (!pc) {
          return
        }

        await pc.setRemoteDescription(answer);   // <- SDP first
        console.log("In answer", answer, fromId)
        console.log("In answer", pc.remoteDescription)
        // drain any candidates we got too early
        for (const c of pendingCandidates.current[fromId] ?? []) {
          try { await pc.addIceCandidate(c); } catch (e) { console.error(e); }
        }
        delete pendingCandidates.current[fromId];
        break;
      }

      case "ice-candidate": {
        const fromId = data.from
        const { candidate } = data
        const pc = peerConnectionsRef.current[fromId]
        console.log(pc)
        console.log(candidate)
        console.log(fromId)
        if (!pc || !candidate) return
        if (pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(candidate);
            console.log("Added candidate", candidate, fromId)
          }
          catch (e) { console.error("addIceCandidate failed:", e); }
        } else {
          // otherwise queue it
          (pendingCandidates.current[fromId] ??= []).push(candidate);
        }
        break;
      }

      case "peer-left": {
        const departedId = data.clientId
        const pc = peerConnectionsRef.current[departedId]
        if (pc) {
          pc.close()
        }

        removePeerConnection(departedId)

        setRemoteStreams((prev) => {
          const newMap = { ...prev }
          delete newMap[departedId]
          return newMap
        })
        // delete remoteStreams.current[departedId]

        break
      }

      default:
        break
    }
  }

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return

    const newMessage = {
      id: chatMessages.length + 1,
      sender: "You",
      content: chatMessage,
      time: "just now",
    }

    setChatMessages([...chatMessages, newMessage])
    setChatMessage("")
  }

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks()
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled
      })
      setIsMuted(!isMuted)
    }
  }

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks()
      videoTracks.forEach((track) => {
        track.enabled = !track.enabled
      })
      setIsVideoOff(!isVideoOff)
    }
  }



  return (
    <div className="flex h-screen w-screen bg-[#13002C] text-white">
      {/* Left sidebar */}
      <div className="w-[180px] bg-[#1D0C32] flex flex-col items-center py-6 border-r border-[#3F2D5A]">
        <div className="mb-8">
          <div className="rounded-full bg-[#FF6B4A] p-3">
            <Video className="h-6 w-6 text-white" />
          </div>
        </div>

        <nav className="flex flex-col space-y-8 w-full">
          <NavItem icon={<Home />} label="Home" active={false} />
          <NavItem icon={<Calendar />} label="Calendar" active={false} />
          <NavItem icon={<Video />} label="Meeting" active={true} />
          <NavItem icon={<Settings />} label="Setting" active={false} />
          <div className="flex-grow"></div>
          <NavItem icon={<LogOut />} label="Log Out" active={false} danger />
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="h-16 border-b border-[#3F2D5A] flex items-center justify-between px-4">
          <div className="relative w-[350px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search here"
              className="w-full pl-10 pr-4 py-2 bg-[#2B1644] border border-[#4F3A6F] rounded-full text-sm text-white"
            />
          </div>
          <div className="flex items-center space-x-6 py-4">
            <div className="text-sm text-gray-300">{currentTime}</div>
            <div className="w-10 h-10 rounded-full bg-[#FF6B4A] flex items-center justify-center overflow-hidden">
              <img src="/avatar.svg" alt="User" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>

        {/* Meeting content */}
        <div className="relative flex-1 flex">
          {/* Video area */}
          <div className="relative flex-1 flex flex-col px-4 py-4">
            <div className="flex flex-row justify-between">
              <h1 className="text-2xl font-semibold">{meetingTitle}</h1>

              <div className="flex items-center">
                <button className="flex items-center bg-[#2B1644] px-3 py-1 rounded-md text-sm space-x-1">
                  <Plus className="h-4 w-4" />
                  <span>Add Participants</span>
                </button>
              </div>

            </div>

            {/* Main video display */}
            <div className="flex flex-1 flex-col relative rounded-lg bg-black w-fit">
              <div className="absolute top-2 left-2 bg-black/50 text-white px-2 py-0.5 rounded text-xs">15:30</div>
              <video ref={localVideoRef} autoPlay muted className="relative h-full object-fit rounded-lg" />
              {/* <VideoPlayer stream={localStreamRef.current} peerId={(clientId) ? clientId : ''} /> */}
            </div>

            {/* Participant thumbnails */}
            <div className="absolute right-10 top-12 flex justify-start space-y-2 p-2 flex-col w-1/3 h-3/4 overflow-scroll">
              {Object.entries(remoteStreams).length > 0 ? (
                Object.entries(remoteStreams).map(([peerId, stream]) => (
                  <VideoPlayer
                    key={peerId}
                    stream={stream}
                    peerId={peerId}
                  />
                ))
              ) : (
                <></>
              )}
            </div>

            {/* Control buttons */}
            <div className="flex justify-center space-x-4 py-4">
              <button className={`rounded-full p-3 ${isMuted ? "bg-red-500" : "bg-white"}`} onClick={toggleMute}>
                {isMuted ? (
                  <MicOff className={`h-full ${isMuted ? "text-white" : "text-black"}`} />
                ) : (
                  <Mic className={`h-full ${isMuted ? "text-white" : "text-black"}`} />
                )}
              </button>
              <button className={`rounded-full p-3 ${isVideoOff ? "bg-red-500" : "bg-white"}`} onClick={toggleVideo}>
                {isVideoOff ? <CameraOff className="h-5 w-5 text-white" /> : <Camera className="h-5 w-5 text-black" />}
              </button>
              <button className="rounded-full p-3 bg-red-500">
                <Phone className="h-full text-white" />
              </button>
              <button className="rounded-full p-3 bg-white">
                <Share2 className="h-full w-5 text-black" />
              </button>
              <button className="rounded-full p-3 bg-white">
                <Settings className="h-full w-5 text-black" />
              </button>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="h-full w-72 border-l border-[#3F2D5A] flex flex-col">
            {/* Participant section */}
            <div className="p-4 border-b border-[#3F2D5A]">
              <div className="flex justify-between items-center">
                <div className="text-lg font-medium">Participant ({participants.length})</div>
                <button>
                  <MoreVertical className="h-5 w-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-3 overflow-scroll">
                {participants.map((participant) => (
                  <div key={participant.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full overflow-hidden">
                        <img
                          src={participant.avatar || "/placeholder.svg"}
                          alt={participant.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{participant.name}</div>
                        {participant.isHost && <div className="text-xs text-blue-400">Host</div>}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      {!participant.isMuted && (
                        <div className="text-blue-400">
                          <Mic className="h-4 w-4" />
                        </div>
                      )}
                      {participant.isVideoOn && (
                        <div className="text-blue-400">
                          <Camera className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chat section */}
            <div className="flex-1 flex flex-col">
              <div className="p-4 border-b border-[#3F2D5A]">
                <h3 className="text-lg font-medium">Group Chat</h3>
              </div>

              <div className="flex-1 overflow-y-scroll p-4 space-y-4">
                {chatMessages.map((message) => (
                  <div key={message.id} className={`flex ${message.sender === "You" ? "justify-end" : ""}`}>
                    {message.sender !== "You" && (
                      <div className="w-8 h-8 rounded-full overflow-hidden mr-2 flex-shrink-0">
                        <img
                          src="/placeholder.svg?height=32&width=32"
                          alt={message.sender}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="max-w-[80%]">
                      {message.sender !== "You" && (
                        <div className="text-xs text-gray-400 mb-1 flex items-center">
                          {message.sender} <span className="ml-1 text-gray-500 text-[10px]">{message.time}</span>
                        </div>
                      )}
                      <div
                        className={`rounded-lg px-3 py-2 text-sm ${message.sender === "You" ? "bg-white text-black" : "bg-[#2B1644] text-white"
                          }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-2 border-t border-[#3F2D5A]">
                <div className="flex items-center bg-[#2B1644] rounded-full">
                  <input
                    type="text"
                    placeholder="Write a message..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSendMessage()
                    }}
                    className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-sm"
                  />
                  <button onClick={handleSendMessage} className="p-2 bg-blue-500 rounded-full mx-1">
                    <Send className="h-4 w-4 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
