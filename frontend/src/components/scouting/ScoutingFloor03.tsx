import React from 'react';
import type { SimilarPlayer } from '../../services/api';
import type { ScoutingTranslations } from '../../i18n/scoutingReport';
import { BeeswarmCard } from './floor03/BeeswarmCard';
import { ScatterPlotCard } from './floor03/ScatterPlotCard';
import { DefendingPitchCard } from './floor03/DefendingPitchCard';
import type {
  BeeswarmPoint,
  BeeswarmStripData,
  BeeswarmHoverState,
  ScatterPoint,
} from './floor03/scoutingFloor03Utils';
import type { ScatterPlotProcessedResult } from './floor03/scoutingFloor03Data';

export interface ScoutingFloor03Props {
  beeswarmStrips: BeeswarmStripData[];
  getTopStripPeers: (strip: BeeswarmStripData) => BeeswarmPoint[];
  peerColors: string[];
  clubTextColor: string;
  clubThemeColor: string;
  hoveredBeeswarmPoint: BeeswarmHoverState | null;
  onHoverBeeswarmPoint: React.Dispatch<React.SetStateAction<BeeswarmHoverState | null>>;
  hoveredScatterPoint: ScatterPoint | null;
  onHoverScatterPoint: React.Dispatch<React.SetStateAction<ScatterPoint | null>>;
  onSelectPlayer: (targetId: number) => void;
  playerAge: number | null;
  resolvePlayerAge: (player?: any) => number | null;
  similarPlayersMap: Map<number, SimilarPlayer>;
  scatterResult: ScatterPlotProcessedResult;
  playerName: string;
  defendingGrid: number[][];
  totalDefendingActions: number;
  tacklesCount: number;
  recoveriesCount: number;
  aerialCount: number;
  getDefendingCellFill: (count: number) => string;
  t: ScoutingTranslations;
}

export const ScoutingFloor03: React.FC<ScoutingFloor03Props> = ({
  beeswarmStrips,
  getTopStripPeers,
  peerColors,
  clubTextColor,
  clubThemeColor,
  hoveredBeeswarmPoint,
  onHoverBeeswarmPoint,
  hoveredScatterPoint,
  onHoverScatterPoint,
  onSelectPlayer,
  playerAge,
  resolvePlayerAge,
  similarPlayersMap,
  scatterResult,
  playerName,
  defendingGrid,
  totalDefendingActions,
  tacklesCount,
  recoveriesCount,
  aerialCount,
  getDefendingCellFill,
  t,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch w-full">
      {/* FLOOR 3 LEFT: 3 Standalone Distribution Cards (Cols 1-4) */}
      <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/80 p-3 flex flex-col justify-between h-full shadow-2xs">
        {beeswarmStrips.map((strip) => (
          <BeeswarmCard
            key={`strip-${strip.key}`}
            strip={strip}
            similarPeers={getTopStripPeers(strip)}
            peerColors={peerColors}
            targetRingColor={clubTextColor}
            hoveredPoint={hoveredBeeswarmPoint}
            onHoverPoint={onHoverBeeswarmPoint}
            onSelectPlayer={onSelectPlayer}
            playerAge={playerAge}
            resolvePlayerAge={resolvePlayerAge}
            similarPlayersMap={similarPlayersMap}
            t={t}
          />
        ))}
      </div>

      {/* FLOOR 3 RIGHT CONTAINER: 3B Scatter + 3C Defending (Cols 5-12) */}
      <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-[1fr_285px] gap-3 h-full">
        {/* FLOOR 3 CENTER: Large 2D Scatterplot */}
        <ScatterPlotCard
          rawPoints={scatterResult.points}
          backgroundPeerPoints={scatterResult.backgroundPeerPoints}
          minX={scatterResult.minX}
          maxX={scatterResult.maxX}
          minY={scatterResult.minY}
          maxY={scatterResult.maxY}
          medianX={scatterResult.medianX}
          medianY={scatterResult.medianY}
          xTicks={scatterResult.xTicks}
          yTicks={scatterResult.yTicks}
          metricXLabel={scatterResult.metricXLabel}
          metricYLabel={scatterResult.metricYLabel}
          xStep={scatterResult.xStep}
          yStep={scatterResult.yStep}
          highlightedPeers={scatterResult.highlightedPeerPoints}
          targetPoint={scatterResult.targetPoint}
          clubTextColor={clubTextColor}
          peerRingColors={peerColors}
          hoveredPoint={hoveredScatterPoint}
          onHoverPoint={onHoverScatterPoint}
          onSelectPlayer={onSelectPlayer}
          playerAge={playerAge}
          resolvePlayerAge={resolvePlayerAge}
          similarPlayersMap={similarPlayersMap}
          t={t}
        />

        {/* FLOOR 3 RIGHT: Dedicated Vertical Defending Zonal Grid Pitch */}
        <DefendingPitchCard
          playerName={playerName}
          clubThemeColor={clubThemeColor}
          defendingGrid={defendingGrid}
          totalDefendingActions={totalDefendingActions}
          tacklesCount={tacklesCount}
          recoveriesCount={recoveriesCount}
          aerialCount={aerialCount}
          getDefendingCellFill={getDefendingCellFill}
          t={t}
        />
      </div>
    </div>
  );
};

export default ScoutingFloor03;
