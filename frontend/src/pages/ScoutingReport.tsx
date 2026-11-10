import React from 'react';
import ScoutingConfigPanel from '../components/scouting/ScoutingConfigPanel';
import ScoutingFloor01 from '../components/scouting/ScoutingFloor01';
import ScoutingFloor02 from '../components/scouting/ScoutingFloor02';
import ScoutingFloor03 from '../components/scouting/ScoutingFloor03';
import ScoutingExportBar from '../components/scouting/ScoutingExportBar';
import { PlayerNodeAvatar } from '../components/scouting/PlayerNodeAvatar';
import { useScoutingReportData } from '../components/scouting/useScoutingReportData';
import type {
  BeeswarmPoint,
  BeeswarmTick,
  BeeswarmStripData,
  BeeswarmHoverState,
  ScatterPoint,
  RadarMetricDef,
  RoleMetricPreset,
} from '../components/scouting/scoutingTypes';
import {
  RADAR_CENTER_X,
  RADAR_CENTER_Y,
  RADAR_MAX_RADIUS,
  RADAR_LABEL_RADIUS,
  RADAR_METRICS,
  ROLE_RADAR_KEYS,
  AVAILABLE_METRICS,
  ROLE_METRIC_PRESETS,
  DEFAULT_METRIC_PRESET,
  POSITION_GROUPS,
  PEER_RING_CLASSES,
  PEER_RING_COLORS,
} from '../components/scouting/scoutingConstants';
import { resolvePlayerAge } from '../utils/scoutingUtils';

export {
  PlayerNodeAvatar,
  RADAR_CENTER_X,
  RADAR_CENTER_Y,
  RADAR_MAX_RADIUS,
  RADAR_LABEL_RADIUS,
  ROLE_RADAR_KEYS,
  ROLE_METRIC_PRESETS,
  DEFAULT_METRIC_PRESET,
  PEER_RING_CLASSES,
};

export type {
  BeeswarmPoint,
  BeeswarmTick,
  BeeswarmStripData,
  BeeswarmHoverState,
  ScatterPoint,
  RadarMetricDef,
  RoleMetricPreset,
};

const ScoutingReport: React.FC = () => {
  const {
    lang, setLang, t, playerId, playerName, playerAge, countryCode, positionLabel, cohortHeaderLabel, onSelectPlayer,
    minAge, setMinAge, maxAge, setMaxAge, selectedLeagues, toggleLeague,
    excludeDropdownRef, isExcludeDropdownOpen, setIsExcludeDropdownOpen,
    appliedExcludedTeams, setAppliedExcludedTeams, pendingExcludedTeams, setPendingExcludedTeams,
    teamSearchQuery, setTeamSearchQuery, teams, filteredTeams,
    benchmarkMode, setBenchmarkMode, targetGroup, setTargetGroup, currentRole, applyPreset,
    xAxisMetric, setXAxisMetric, yAxisMetric, setYAxisMetric,
    beeswarm1, setBeeswarm1, beeswarm2, setBeeswarm2, beeswarm3, setBeeswarm3,
    selectedPositionGroup, setSelectedPositionGroup,
    playerSearchRef, isPlayerSearchOpen, setIsPlayerSearchOpen,
    isProfileLoading, profile, playerSearchQuery, setPlayerSearchQuery, isSearchLoading, searchResults,
    radarDropdownRef, isRadarDropdownOpen, setIsRadarDropdownOpen,
    activeRadarSlices, setActiveRadarSlices, radarSliceOptions, toggleRadarSlice,
    dossierRef, seasonStats, matchStats, activeMetrics, radarGeometry,
    hoveredMetric, setHoveredMetric, clubThemeColor, clubTextColor, clubTextRgb, radarBadgeTextColor,
    getSplitMetricLabel, currentLeaderboardStat, activeHoveredMetricDef, isTopPlayersLoading, topPlayers,
    teamMap, similarPlayers, similarPlayersMap, isSimilarLoading,
    shotsData, passesData, defendingData, heatmapData,
    beeswarmStrips, getTopStripPeers, hoveredBeeswarmPoint, setHoveredBeeswarmPoint,
    hoveredScatterPoint, setHoveredScatterPoint, scatterResult,
    defendingGrid, totalDefendingActions, tacklesCount, recoveriesCount, aerialCount, getDefendingCellFill,
    isExportingPng, isExportingPdf, handleDownloadPNG, handleDownloadPDF,
  } = useScoutingReportData();

  return (
    <div className="min-h-screen bg-white text-slate-800 antialiased font-sans p-[12px] w-full flex flex-col gap-3">
      {/* =================================================================== */}
      {/* TIER 1: FULL-WIDTH CONFIGURATION PANEL                              */}
      {/* =================================================================== */}
      <ScoutingConfigPanel
        t={t}
        lang={lang}
        setLang={setLang}
        minAge={minAge}
        setMinAge={setMinAge}
        maxAge={maxAge}
        setMaxAge={setMaxAge}
        selectedLeagues={selectedLeagues}
        toggleLeague={toggleLeague}
        excludeDropdownRef={excludeDropdownRef}
        isExcludeDropdownOpen={isExcludeDropdownOpen}
        setIsExcludeDropdownOpen={setIsExcludeDropdownOpen}
        appliedExcludedTeams={appliedExcludedTeams}
        setAppliedExcludedTeams={setAppliedExcludedTeams}
        pendingExcludedTeams={pendingExcludedTeams}
        setPendingExcludedTeams={setPendingExcludedTeams}
        teamSearchQuery={teamSearchQuery}
        setTeamSearchQuery={setTeamSearchQuery}
        teams={teams}
        filteredTeams={filteredTeams}
        benchmarkMode={benchmarkMode}
        setBenchmarkMode={setBenchmarkMode}
        targetGroup={targetGroup}
        setTargetGroup={setTargetGroup}
        currentRole={currentRole}
        applyPreset={applyPreset}
        xAxisMetric={xAxisMetric}
        setXAxisMetric={setXAxisMetric}
        yAxisMetric={yAxisMetric}
        setYAxisMetric={setYAxisMetric}
        beeswarm1={beeswarm1}
        setBeeswarm1={setBeeswarm1}
        beeswarm2={beeswarm2}
        setBeeswarm2={setBeeswarm2}
        beeswarm3={beeswarm3}
        setBeeswarm3={setBeeswarm3}
        availableMetrics={AVAILABLE_METRICS}
        selectedPositionGroup={selectedPositionGroup}
        setSelectedPositionGroup={setSelectedPositionGroup}
        positionGroups={POSITION_GROUPS}
        playerSearchRef={playerSearchRef}
        isPlayerSearchOpen={isPlayerSearchOpen}
        setIsPlayerSearchOpen={setIsPlayerSearchOpen}
        isProfileLoading={isProfileLoading}
        profile={profile}
        playerId={playerId}
        playerSearchQuery={playerSearchQuery}
        setPlayerSearchQuery={setPlayerSearchQuery}
        isSearchLoading={isSearchLoading}
        searchResults={searchResults}
        onSelectPlayer={onSelectPlayer}
        radarDropdownRef={radarDropdownRef}
        isRadarDropdownOpen={isRadarDropdownOpen}
        setIsRadarDropdownOpen={setIsRadarDropdownOpen}
        activeRadarSlices={activeRadarSlices}
        setActiveRadarSlices={setActiveRadarSlices}
        radarSliceOptions={radarSliceOptions}
        toggleRadarSlice={toggleRadarSlice}
      />

      {/* =================================================================== */}
      {/* TIER 2: FULL-BLEED PANORAMIC DOSSIER CANVAS                         */}
      {/* =================================================================== */}
      <div id="scouting-dossier-canvas" ref={dossierRef} className="w-full max-w-full bg-[#EEF0EE] p-[10px] flex flex-col gap-[10px] rounded-[8px]">
        {/* ----------------------------------------------------------------- */}
        {/* FLOOR 1: Bio & Polar Pizza Rose Radar Section                     */}
        {/* ----------------------------------------------------------------- */}
        <ScoutingFloor01
          t={t}
          lang={lang}
          playerId={playerId}
          playerName={playerName}
          profile={profile}
          seasonStats={seasonStats}
          matchStats={matchStats}
          positionLabel={positionLabel}
          playerAge={playerAge}
          countryCode={countryCode}
          cohortHeaderLabel={cohortHeaderLabel}
          activeMetrics={activeMetrics}
          radarGeometry={radarGeometry}
          hoveredMetric={hoveredMetric}
          setHoveredMetric={setHoveredMetric}
          clubThemeColor={clubThemeColor}
          clubTextColor={clubTextColor}
          clubTextRgb={clubTextRgb}
          radarBadgeTextColor={radarBadgeTextColor}
          getSplitMetricLabel={getSplitMetricLabel}
          currentLeaderboardStat={currentLeaderboardStat}
          activeHoveredMetricDef={activeHoveredMetricDef}
          radarMetrics={RADAR_METRICS}
          isTopPlayersLoading={isTopPlayersLoading}
          topPlayers={topPlayers}
        />

        {/* ----------------------------------------------------------------- */}
        {/* FLOOR 2: Similarity & Real Event Pitches Section                  */}
        {/* ----------------------------------------------------------------- */}
        <ScoutingFloor02
          playerId={playerId}
          playerName={playerName}
          positionLabel={positionLabel}
          clubThemeColor={clubThemeColor}
          seasonStats={seasonStats}
          teamMap={teamMap}
          similarPlayers={similarPlayers}
          isSimilarLoading={isSimilarLoading}
          shotsData={shotsData}
          passesData={passesData}
          defendingData={defendingData}
          heatmapData={heatmapData}
          t={t}
          onSelectPlayer={onSelectPlayer}
        />

        {/* ----------------------------------------------------------------- */}
        {/* FLOOR 3: Distributions & Defending Section                         */}
        {/* ----------------------------------------------------------------- */}
        <ScoutingFloor03
          beeswarmStrips={beeswarmStrips}
          getTopStripPeers={getTopStripPeers}
          peerColors={PEER_RING_COLORS}
          clubTextColor={clubTextColor}
          clubThemeColor={clubThemeColor}
          hoveredBeeswarmPoint={hoveredBeeswarmPoint}
          onHoverBeeswarmPoint={setHoveredBeeswarmPoint}
          hoveredScatterPoint={hoveredScatterPoint}
          onHoverScatterPoint={setHoveredScatterPoint}
          onSelectPlayer={onSelectPlayer}
          playerAge={playerAge}
          resolvePlayerAge={resolvePlayerAge}
          similarPlayersMap={similarPlayersMap}
          scatterResult={scatterResult}
          playerName={playerName}
          defendingGrid={defendingGrid}
          totalDefendingActions={totalDefendingActions}
          tacklesCount={tacklesCount}
          recoveriesCount={recoveriesCount}
          aerialCount={aerialCount}
          getDefendingCellFill={getDefendingCellFill}
          t={t}
        />
      </div>

      {/* =================================================================== */}
      {/* TIER 3: BOTTOM EXPORT BUTTONS                                       */}
      {/* =================================================================== */}
      <ScoutingExportBar
        onDownloadPNG={handleDownloadPNG}
        onDownloadPDF={handleDownloadPDF}
        isExportingPng={isExportingPng}
        isExportingPdf={isExportingPdf}
        t={t}
      />
    </div>
  );
};

export default ScoutingReport;
