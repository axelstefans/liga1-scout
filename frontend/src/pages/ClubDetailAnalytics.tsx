import React from 'react';
import {
  ClubInstitutionalHeader,
  ClubTacticalToolbar,
  ClubMatchReportView,
  ClubGeneralPerformanceGrid,
  useClubDetailAnalytics,
} from '../components/clubs';

export const ClubDetailAnalytics: React.FC = () => {
  const analytics = useClubDetailAnalytics();

  return (
    <div className="min-h-screen bg-[#f8f9fa] w-full px-2 sm:px-4 lg:px-6 py-4 text-slate-900">
      <div className="w-full space-y-4">
        {/* 1. INSTITUTIONAL HEADER STRIP */}
        <ClubInstitutionalHeader
          activeTeam={analytics.activeTeam}
          allTeamsList={analytics.allTeamsList}
          teams={analytics.teams}
          isLoading={analytics.isLoading}
          leagueRank={analytics.leagueRank}
          handleClubChange={analytics.handleClubChange}
          handleCopyComprehensiveReport={analytics.handleCopyComprehensiveReport}
          isReportCopied={analytics.isReportCopied}
          selectedTournament={analytics.selectedTournament}
          setSelectedTournament={analytics.setSelectedTournament}
          clubViewMode={analytics.clubViewMode}
          setClubViewMode={analytics.setClubViewMode}
        />

        {/* 2. MAIN WORKSPACE: MODE B (MATCH REPORT) vs MODE A (GENERAL PERFORMANCE) */}
        {analytics.clubViewMode === 'match_report' ? (
          <ClubMatchReportView
            validReportMatchId={analytics.validReportMatchId}
            setReportMatchId={analytics.setReportMatchId}
            isLoadingMatches={analytics.isLoadingMatches}
            matches={analytics.matches}
            clubShortDisplay={analytics.clubShortDisplay}
            activeSheet={analytics.activeSheet}
            setActiveSheet={analytics.setActiveSheet}
          />
        ) : (
          <>
            <ClubTacticalToolbar
              perspective={analytics.perspective}
              setPerspective={analytics.setPerspective}
              aggregationMode={analytics.aggregationMode}
              setAggregationMode={analytics.setAggregationMode}
              venue={analytics.venue}
              setVenue={analytics.setVenue}
              contextFilter={analytics.contextFilter}
              setContextFilter={analytics.setContextFilter}
              validMatchId={analytics.validMatchId}
              setSelectedMatchId={analytics.setSelectedMatchId}
              isLoadingMatches={analytics.isLoadingMatches}
              matches={analytics.matches}
              selectedPlayer={analytics.selectedPlayer}
              setSelectedPlayer={analytics.setSelectedPlayer}
              availablePlayers={analytics.availablePlayers}
              dropdownRef={analytics.dropdownRef}
              isDropdownOpen={analytics.isDropdownOpen}
              setIsDropdownOpen={analytics.setIsDropdownOpen}
              activeCount={analytics.activeCount}
              visibleCharts={analytics.visibleCharts}
              toggleChart={analytics.toggleChart}
              handleSelectAll={analytics.handleSelectAll}
              handleReset={analytics.handleReset}
              isEmptyState={analytics.isEmptyState}
              venueLabel={analytics.venueLabel}
              contextFilterLabel={analytics.contextFilterLabel}
            />

            <ClubGeneralPerformanceGrid
              isLoading={analytics.isLoading}
              isError={analytics.isError}
              error={analytics.error}
              refetch={analytics.refetch}
              activeTeam={analytics.activeTeam}
              teams={analytics.teams}
              selectedTournament={analytics.selectedTournament}
              aggregationMode={analytics.aggregationMode}
              validMatchId={analytics.validMatchId}
              venue={analytics.venue}
              contextFilter={analytics.contextFilter}
              perspective={analytics.perspective}
              selectedPlayer={analytics.selectedPlayer}
              visibleCharts={analytics.visibleCharts}
              hasFloor1Charts={analytics.hasFloor1Charts}
              hasFloor2Charts={analytics.hasFloor2Charts}
              bothFloor2Active={analytics.bothFloor2Active}
              handleReset={analytics.handleReset}
              flashscoreSummary={analytics.flashscoreSummary}
              isFlashscoreLoading={analytics.isFlashscoreLoading}
              mostUsedXIData={analytics.mostUsedXIData}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default ClubDetailAnalytics;
