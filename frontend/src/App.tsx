import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import ScoutingReport from './pages/ScoutingReport';
import TeamLeagueAnalytics from './pages/TeamLeagueAnalytics';
import ClubDetailAnalytics from './pages/ClubDetailAnalytics';

function PlayerRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/scouting/${id}` : '/scouting'} replace />;
}

function AppContent() {
  const location = useLocation();
  const isScouting = location.pathname.startsWith('/scouting');
  const isClubs = location.pathname.startsWith('/clubs');

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className={isScouting || isClubs ? 'flex-grow' : 'flex-grow p-4 md:p-8'}>
        <Routes>
          <Route path="/" element={<Navigate to="/scouting" replace />} />
          <Route path="/player/:id" element={<PlayerRedirect />} />
          <Route path="/scouting" element={<ScoutingReport />} />
          <Route path="/scouting/:id" element={<ScoutingReport />} />
          <Route path="/teams" element={<TeamLeagueAnalytics />} />
          <Route path="/clubs" element={<ClubDetailAnalytics />} />
          <Route path="/clubs/:id" element={<ClubDetailAnalytics />} />
          <Route path="*" element={<Navigate to="/scouting" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
