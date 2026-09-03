import React, { useRef, useEffect, useMemo } from 'react';
import { usePlayerHeatmap } from '../hooks/usePlayer';

interface SeasonHeatmapProps {
  playerId: number;
  themeColor?: string;
}

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#dc2626');
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '220, 38, 38';
};

const SeasonHeatmap: React.FC<SeasonHeatmapProps> = ({ playerId, themeColor }) => {
  const { data, isLoading, error } = usePlayerHeatmap(playerId);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const maxCount = useMemo(() => {
    if (!data || data.length === 0) return 0;
    return Math.max(...data.map(d => d.count));
  }, [data]);

  useEffect(() => {
    if (!data || data.length === 0 || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pitchWidth = 400;
    const pitchHeight = 260;

    // Draw the heat blobs
    data.forEach(point => {
      // Map coordinates: x=0 is left, y=0 is bottom
      const cx = (point.x / 100) * pitchWidth;
      const cy = pitchHeight - (point.y / 100) * pitchHeight;

      // Normalize count
      const countNormalized = maxCount > 0 ? point.count / maxCount : 0;
      
      const radius = 20;

      // Create radial gradient for the blob
      const rgbColor = hexToRgb(themeColor || '#dc2626');
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, `rgba(${rgbColor}, ${0.2 * countNormalized})`);
      gradient.addColorStop(1, `rgba(${rgbColor}, 0)`);

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.fillStyle = gradient;
      ctx.fill();
    });
  }, [data, maxCount]);

  return (
    <div className="bg-card border border-border p-6 rounded-lg shadow-sm">
      <h3 className="text-xl font-display mb-4 text-navy">SEASON HEATMAP</h3>
      
      {isLoading && (
        <div className="h-64 flex flex-col items-center justify-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy"></div>
        </div>
      )}

      {error && !isLoading && (
        <div className="h-64 flex items-center justify-center">
          <p className="text-sm text-red-500">Failed to load heatmap data.</p>
        </div>
      )}

      {!isLoading && !error && (!data || data.length === 0) && (
        <div className="h-64 flex items-center justify-center">
          <p className="text-sm text-gray-500">Heatmap data not available for this player.</p>
        </div>
      )}

      {!isLoading && !error && data && data.length > 0 && (
        <div className="w-full mx-auto relative bg-[#FFFFFF] rounded-lg overflow-hidden border-4 border-[#FFFFFF]" style={{ maxWidth: '400px' }}>
          
          {/* Canvas Layer - Rendering Heat Blobs */}
          <canvas
            ref={canvasRef}
            width={400}
            height={260}
            className="absolute inset-0 w-full h-full z-10"
            style={{ filter: 'blur(8px)' }}
          />

          {/* SVG Pitch Markings Layer - Rendered on top of Canvas */}
          <svg viewBox="0 0 400 260" className="relative w-full h-auto z-20 pointer-events-none" style={{ background: 'transparent' }}>
            {/* Pitch outer boundary */}
            <rect x="0" y="0" width="400" height="260" fill="none" stroke="#000000" strokeWidth="1" />
            
            {/* Center line */}
            <line x1="200" y1="0" x2="200" y2="260" stroke="#000000" strokeWidth="1" />
            {/* Center circle */}
            <circle cx="200" cy="130" r="40" stroke="#000000" strokeWidth="1" fill="none" />
            <circle cx="200" cy="130" r="2" fill="#000000" />
            
            {/* Left Penalty Area */}
            <rect x="0" y="55" width="65" height="150" stroke="#000000" strokeWidth="1" fill="none" />
            {/* Left Goal Area */}
            <rect x="0" y="95" width="20" height="70" stroke="#000000" strokeWidth="1" fill="none" />
            {/* Left D Arc */}
            <path d="M 65 95 A 40 40 0 0 1 65 165" stroke="#000000" strokeWidth="1" fill="none" />
            {/* Left corner arcs */}
            <path d="M 0 10 A 10 10 0 0 0 10 0" stroke="#000000" strokeWidth="1" fill="none" />
            <path d="M 0 250 A 10 10 0 0 1 10 260" stroke="#000000" strokeWidth="1" fill="none" />

            {/* Right Penalty Area */}
            <rect x="335" y="55" width="65" height="150" stroke="#000000" strokeWidth="1" fill="none" />
            {/* Right Goal Area */}
            <rect x="380" y="95" width="20" height="70" stroke="#000000" strokeWidth="1" fill="none" />
            {/* Right D Arc */}
            <path d="M 335 95 A 40 40 0 0 0 335 165" stroke="#000000" strokeWidth="1" fill="none" />
            {/* Right corner arcs */}
            <path d="M 400 10 A 10 10 0 0 1 390 0" stroke="#000000" strokeWidth="1" fill="none" />
            <path d="M 400 250 A 10 10 0 0 0 390 260" stroke="#000000" strokeWidth="1" fill="none" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default SeasonHeatmap;
