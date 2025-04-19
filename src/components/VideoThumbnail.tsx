// @ts-nocheck
import { useEffect, useRef } from 'react'
import { Mic } from 'lucide-react'

// Video thumbnail component
export function VideoThumbnail({ stream, peerId } : { stream: MediaStream, peerId: string }) {
    // const videoRef = useRef<HTMLVideoElement>(null)
  
    // useEffect(() => {
    //   if (videoRef.current) {
    //     videoRef.current.srcObject = stream
    //   }
    // }, [stream])
  
    return (
      <div className="relative h-[110px] w-[110px] rounded-lg overflow-hidden bg-black">
        <div className="absolute top-0 left-0 bg-blue-500/90 p-1 rounded-br text-xs">
          <Mic className="h-3 w-3" />
        </div>
        <video ref={stream} autoPlay className="w-full h-full object-cover" />
      </div>
    )
  }
  

  