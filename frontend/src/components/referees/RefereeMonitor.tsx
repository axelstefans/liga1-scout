import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { getReferees, getRefereeDetail } from '../../services/api';
import RefereeTable from './RefereeTable';
import RefereeDetailPanel from './RefereeDetailPanel';
import type { RefereeSummary, RefereeDetailResponse } from '../../types/referee';

interface RefereeMonitorProps {
  tournament: 'all' | 'Apertura' | 'Clausura';
}

export const RefereeMonitor: React.FC<RefereeMonitorProps> = ({ tournament }) => {
  const [selectedRefereeId, setSelectedRefereeId] = useState<number | null>(null);
  const [historyLimit, setHistoryLimit] = useState<number>(5);

  const queryTournament = tournament === 'all' ? undefined : tournament;

  // 1. Fetch referees list
  const {
    data: referees = [],
    isLoading: isRefereesLoading,
    isError: isRefereesError,
    error: refereesError,
    refetch: refetchReferees,
  } = useQuery<RefereeSummary[], Error>({
    queryKey: ['referees', queryTournament],
    queryFn: () => getReferees(queryTournament),
    staleTime: 5 * 60 * 1000,
  });

  // Automatically select the first referee when list loads or changes
  useEffect(() => {
    if (referees.length > 0) {
      if (!selectedRefereeId || !referees.some((r) => r.referee_id === selectedRefereeId)) {
        setSelectedRefereeId(referees[0].referee_id);
      }
    } else {
      setSelectedRefereeId(null);
    }
  }, [referees, selectedRefereeId]);

  // 2. Fetch selected referee detail
  const {
    data: refereeDetail = null,
    isLoading: isDetailLoading,
  } = useQuery<RefereeDetailResponse | null, Error>({
    queryKey: ['refereeDetail', selectedRefereeId, historyLimit],
    queryFn: () => {
      if (!selectedRefereeId) return Promise.resolve(null);
      return getRefereeDetail(selectedRefereeId, historyLimit);
    },
    enabled: !!selectedRefereeId,
    staleTime: 5 * 60 * 1000,
  });

  if (isRefereesError) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-rose-900">Error al cargar datos arbitrales</h3>
        <p className="text-xs text-rose-700 mt-1">
          {refereesError?.message || 'No se pudo conectar con el endpoint de árbitros.'}
        </p>
        <button
          onClick={() => refetchReferees()}
          className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* LEFT COLUMN: Referee Ranking Table (7 cols on desktop) */}
      <div className="lg:col-span-7">
        <RefereeTable
          referees={referees}
          selectedRefereeId={selectedRefereeId}
          onSelectReferee={setSelectedRefereeId}
          isLoading={isRefereesLoading}
        />
      </div>

      {/* RIGHT COLUMN: Referee Profile KPIs & ONEFA Match Cards (5 cols on desktop) */}
      <div className="lg:col-span-5">
        <RefereeDetailPanel
          detail={refereeDetail}
          isLoading={isDetailLoading}
          historyLimit={historyLimit}
          onLimitChange={setHistoryLimit}
        />
      </div>
    </div>
  );
};

export default RefereeMonitor;
