import { Video } from 'lucide-react'
import { useState } from 'react'

export default function WaitingRoom() {
    const [roomId, setRoomId] = useState('')
    const [meetingTitle, setMeetingTitle] = useState('')

    const handleJoin = () => {
        if (roomId && meetingTitle) {
            // Redirect to the video call page with the room ID and meeting title
            window.location.href = `/meeting?roomId=${roomId}&meetingTitle=${meetingTitle}`
        } else {
            alert('Please enter both Room ID and Meeting Title')
        }
    }


    return (
        <div className="flex h-screen items-center justify-center bg-background-primary">
            <div className="w-full max-w-md p-6 space-y-6">
                <div className="flex justify-center mb-8">
                    <div className="rounded-full bg-component-primary p-3">
                        <Video className="h-6 w-6 text-white" />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-white text-center mb-6">Join Video Meeting</h1>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="room-id" className="block text-sm font-medium text-gray-200 mb-1">
                            Room ID
                        </label>
                        <input
                            id="room-id"
                            type="text"
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value)}
                            placeholder="Enter room ID"
                            className="w-full px-4 py-2 rounded-lg bg-[#2B1644] border border-[#4F3A6F] text-white focus:outline-none focus:ring-2 focus:ring-component-primary"
                        />
                    </div>

                    <div>
                        <label htmlFor="meeting-title" className="block text-sm font-medium text-gray-200 mb-1">
                            Meeting Title
                        </label>
                        <input
                            id="meeting-title"
                            type="text"
                            value={meetingTitle}
                            onChange={(e) => setMeetingTitle(e.target.value)}
                            placeholder="Enter meeting title"
                            className="w-full px-4 py-2 rounded-lg bg-[#2B1644] border border-[#4F3A6F] text-white focus:outline-none focus:ring-2 focus:ring-component-primary"
                        />
                    </div>


                    <button
                        onClick={handleJoin}
                        className="w-full py-2 px-4 bg-component-primary hover:bg-[#fa2e00] text-white font-semibold rounded-lg transition duration-200"
                    >
                        Join Room
                    </button>
                </div>
            </div>
        </div>
    )
}