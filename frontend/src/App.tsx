import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import PlayerDashboard from './pages/PlayerDashboard';
import ScoutingReport from './pages/ScoutingReport';

function AppContent() {
  const location = useLocation();
  const isScouting = location.pathname.startsWith('/scouting');

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {!isScouting && (
        <header className="bg-navy text-cream py-4 px-6 shadow-md flex items-center justify-between">
          <h1 className="text-3xl m-0 font-display">LIGA 1 SCOUT</h1>
          <nav className="flex items-center space-x-6">
            <Link to="/" className="text-cream hover:text-white transition-colors uppercase font-medium text-sm tracking-wider">Search</Link>
            <Link to="/scouting" className="text-cream hover:text-white transition-colors uppercase font-medium text-sm tracking-wider">Scouting</Link>
          </nav>
        </header>
      )}
      <main className={isScouting ? 'flex-grow' : 'flex-grow p-4 md:p-8'}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/player/:id" element={<PlayerDashboard />} />
          <Route path="/scouting" element={<ScoutingReport />} />
          <Route path="/scouting/:id" element={<ScoutingReport />} />
          <Route path="*" element={<Navigate to="/" replace />} />
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
