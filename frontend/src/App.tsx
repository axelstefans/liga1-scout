import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import PlayerDashboard from './pages/PlayerDashboard';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <header className="bg-navy text-cream py-4 px-6 shadow-md flex items-center justify-between">
          <h1 className="text-3xl m-0 font-display">LIGA 1 SCOUT</h1>
          <nav>
            <a href="/" className="text-cream hover:text-white transition-colors uppercase font-medium text-sm tracking-wider">Search</a>
          </nav>
        </header>
        <main className="flex-grow p-4 md:p-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/player/:id" element={<PlayerDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
