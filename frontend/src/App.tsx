import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import Home from './pages/Home';
import PlayerDashboard from './pages/PlayerDashboard';
import DossierExport from './pages/DossierExport';


function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <header className="bg-navy text-cream py-4 px-6 shadow-md flex items-center justify-between">
          <h1 className="text-3xl m-0 font-display">LIGA 1 SCOUT</h1>
          <nav className="flex items-center space-x-6">
            <Link to="/" className="text-cream hover:text-white transition-colors uppercase font-medium text-sm tracking-wider">Search</Link>

          </nav>
        </header>
        <main className="flex-grow p-4 md:p-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/player/:id" element={<PlayerDashboard />} />
            <Route path="/dossier/:id" element={<DossierExport />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
