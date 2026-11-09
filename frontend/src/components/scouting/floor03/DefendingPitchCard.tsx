import React, { memo } from 'react';

export interface DefendingCellFillResult {
  fill: string;
  opacity: number;
}

export interface DefendingPitchCardProps {
  playerName: string;
  clubThemeColor: string;
  defendingGrid: number[][];
  totalDefendingActions: number;
  tacklesCount: number;
  recoveriesCount: number;
  aerialCount: number;
  getDefendingCellFill?: ((count: number) => DefendingCellFillResult) | ((count: number) => string);
  t: any;
}

const CELL_WIDTH = 13.6;
const CELL_HEIGHT = 17.5;
const PITCH_TOP = 14;

export const DefendingPitchCard: React.FC<DefendingPitchCardProps> = memo(({
  playerName,
  clubThemeColor,
  defendingGrid,
  totalDefendingActions,
  tacklesCount,
  recoveriesCount,
  aerialCount,
  getDefendingCellFill,
  t,
}) => {
  const resolveCellFill = (count: number): DefendingCellFillResult => {
    if (count <= 0) {
      return { fill: 'transparent', opacity: 0 };
    }
    if (getDefendingCellFill) {
      const res = getDefendingCellFill(count);
      if (typeof res === 'object' && res !== null && 'fill' in res && 'opacity' in res) {
        return res;
      }
      if (typeof res === 'string') {
        if (res === 'transparent') {
          return { fill: 'transparent', opacity: 0 };
        }
        const match = res.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (match) {
          const fill = `rgb(${match[1]}, ${match[2]}, ${match[3]})`;
          const opacity = match[4] !== undefined ? parseFloat(match[4]) : 1;
          return { fill, opacity };
        }
        return { fill: res, opacity: 1 };
      }
    }
    let opacity = 0.18;
    if (count > 30) opacity = 0.95;
    else if (count > 20) opacity = 0.75;
    else if (count > 10) opacity = 0.50;
    else if (count > 4) opacity = 0.32;
    return { fill: clubThemeColor || '#10b981', opacity };
  };

  const subtitleText = t?.floor3?.defendingSubtitle
    ? t.floor3.defendingSubtitle(totalDefendingActions, tacklesCount, recoveriesCount, aerialCount)
    : `${totalDefendingActions} total · ${tacklesCount} Tackles · ${recoveriesCount} Recoveries · ${aerialCount} Aerial`;

  return (
    <div
      className="relative w-full h-full flex flex-col justify-center items-center overflow-hidden select-none"
      style={{
        background: '#fafafa',
        border: '1px solid #e0e0e0',
        borderRadius: '6px',
        padding: '8px',
        boxSizing: 'border-box',
      }}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        <svg
          viewBox="-4 -4 76 127"
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full block"
          style={{
            background: '#f5f7f4',
            borderRadius: '6px',
          }}
        >
          {/* Fondo SVG */}
          <rect
            x="-4"
            y="-4"
            width="76"
            height="127"
            rx="6"
            fill="#f5f7f4"
          />

          {/* Encabezado Vectorial Integrado en SVG */}
          <g className="header" pointerEvents="none">
            <text
              x="34"
              y="5"
              textAnchor="middle"
              fill="#1a1d1c"
              fontSize="3.5"
              fontWeight="bold"
              fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            >
              {playerName} — {t?.floor3?.defendingTitle || 'Acciones Defensivas'}
            </text>
            <text
              x="34"
              y="10"
              textAnchor="middle"
              fill="#666"
              fontSize="2.6"
              fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            >
              {subtitleText}
            </text>
          </g>

          {/* Capa 1: Matriz Táctica de 30 Zonas (5 cols x 6 rows) */}
          <g className="heatmap-grid">
            {defendingGrid.map((row, r) =>
              row.map((count, c) => {
                const { fill, opacity } = resolveCellFill(count);
                if (opacity <= 0 || fill === 'transparent') return null;

                const cellX = c * CELL_WIDTH;
                const cellY = PITCH_TOP + r * CELL_HEIGHT;

                return (
                  <rect
                    key={`def-cell-${r}-${c}`}
                    x={cellX}
                    y={cellY}
                    width={CELL_WIDTH}
                    height={CELL_HEIGHT}
                    fill={fill}
                    fillOpacity={opacity}
                    stroke="none"
                  />
                );
              })
            )}
          </g>

          {/* Capa 2: Trazado Reglamentario de Cancha en SVG */}
          <g
            stroke="#1a1d1c"
            strokeWidth="0.3"
            opacity="0.8"
            fill="none"
            pointerEvents="none"
          >
            {/* Perímetro exterior: x ∈ [0, 68], y ∈ [14, 119] */}
            <rect x="0" y="14" width="68" height="105" />

            {/* Arcos y marcas de meta en y=12.5 a 14 y y=119 a 120.5 (x=30.34 a 37.66) */}
            <rect x="30.34" y="12.5" width="7.32" height="1.5" />
            <rect x="30.34" y="119" width="7.32" height="1.5" />

            {/* Línea de mediocampo */}
            <line x1="0" y1="66.5" x2="68" y2="66.5" />

            {/* Círculo central y punto central */}
            <circle cx="34" cy="66.5" r="5.9257" />
            <circle cx="34" cy="66.5" r="0.194" fill="#1a1d1c" />

            {/* Área penal superior (ataque) */}
            <rect x="13.85" y="14" width="40.3" height="16.5" />

            {/* Área chica superior */}
            <rect x="24.85" y="14" width="18.3" height="5.5" />

            {/* Semicírculo superior */}
            <path d="M 27.2 30.5 A 9.15 9.15 0 0 0 40.8 30.5" />

            {/* Área penal inferior (defensa) */}
            <rect x="13.85" y="102.5" width="40.3" height="16.5" />

            {/* Área chica inferior */}
            <rect x="24.85" y="113.5" width="18.3" height="5.5" />

            {/* Semicírculo inferior */}
            <path d="M 27.2 102.5 A 9.15 9.15 0 0 1 40.8 102.5" />
          </g>

          {/* Capa 3: Microtipografía de Conteos Zonal */}
          <g className="heatmap-labels" pointerEvents="none">
            {defendingGrid.map((row, r) =>
              row.map((count, c) => {
                if (count <= 0) return null;

                const { opacity } = resolveCellFill(count);
                const cellCenterX = c * CELL_WIDTH + CELL_WIDTH / 2;
                const cellCenterY = PITCH_TOP + r * CELL_HEIGHT + CELL_HEIGHT / 2;
                const isHighDensity = opacity > 0.4;

                return (
                  <text
                    key={`def-count-${r}-${c}`}
                    x={cellCenterX}
                    y={cellCenterY}
                    dy="0.35em"
                    fontSize="3.2"
                    fontWeight="bold"
                    textAnchor="middle"
                    fill={isHighDensity ? 'white' : '#1a1d1c'}
                    fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                    style={{
                      paintOrder: 'stroke',
                      strokeWidth: '0.4px',
                      stroke: isHighDensity ? 'rgb(26, 29, 28)' : 'rgb(245, 247, 244)',
                    }}
                  >
                    {count}
                  </text>
                );
              })
            )}
          </g>
        </svg>
      </div>
    </div>
  );
});

DefendingPitchCard.displayName = 'DefendingPitchCard';
export default DefendingPitchCard;
