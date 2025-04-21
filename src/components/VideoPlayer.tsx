"use client";
import { useState, useRef, useEffect } from "react";

// A separate component to render each remote video
export function VideoPlayer({ stream, peerId }: { stream: MediaStream, peerId: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
    
    // toggle ASL detection on this stream
    const [detecting, setDetecting] = useState(false);
    // last result from the backend
    const [aslResult, setAslResult] = useState<string | null>(null);
  
    useEffect(() => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    }, [stream]);
  
    // capture frame from video and send to backend
    const captureAndSend = async () => {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        canvas.toBlob(async (blob) => {
          if (blob) {
            const formData = new FormData();
            formData.append('image', blob, 'frame.jpg');
            formData.append('peerId', peerId);
            try {
              // const response = await fetch('https://yolosmarthomeapi.ticklab.site/asl', {
              //   method: 'POST',
              //   body: formData,
              // });
              // const response = await fetch('http://localhost:3000/asl', {
              //     method: 'POST',
              //     body: formData,
              // });
              const response = await fetch('https://aslmeetingapi.ticklab.site/asl', {
                method: 'POST',
                body: formData,
              });
              if (response.ok) {
                const data = await response.json();
                console.log(data)
                console.log('ASL result:', data.label);
                setAslResult(data.label);
              } else {
                console.error('Error sending image to backend:', response.statusText);
              }
            } catch (error) {
              console.error('Error sending image to backend:', error);
            }
          }
        }, 'image/jpeg');
      }
    };
  
    useEffect(() => {
      let intervalId;
      if (detecting) {
          intervalId = setInterval(() => {
              captureAndSend();
          }, 2000); // Capture every second
      }
      else {
          return
      }
      return () => {clearInterval(intervalId)}
    }, [detecting]);
  
    return (
      <div className="relative p-2 flex flex-col items-center">
        {/* <p>{peerId}</p> */}
        <p className="absolute top-4 bg-white rounded-sm text-black text-lg">{aslResult}</p>
        <video ref={videoRef} autoPlay className="w-full rounded-lg"/>
        <button onClick={() => {
          setDetecting(!detecting)
            console.log('Detecting:', !detecting)
          }}
            className={`${detecting ? 'bg-red-500 hover:bg-red-700' : 'bg-blue-500 hover:bg-blue-700'} text-white px-4 py-2 rounded`}>
            {detecting ? 'Stop ASL Detection' : 'Start ASL Detection'}
          
        </button>
        
      </div>
    );
  }