import './App.css';
import { BrowserRouter, Routes, Route} from 'react-router-dom';

import WaitingRoom from './pages/WaitingRoom';
import VideoMeeting from './pages/MeetingRoom';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<WaitingRoom />} />
                <Route path="/meeting" element={<VideoMeeting />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;