import { useState, useCallback } from 'react';

export type ScoutingLang = 'es' | 'en';

const STORAGE_KEY = 'scouting_lang';

export interface MetricTranslation {
  short: string;
  long: string;
  radarSplit: [string, string | null];
}

export interface ScoutingTranslations {
  headerTitle: string;
  config: {
    dataConfigTitle: string;
    minAge: string;
    maxAge: string;
    leaguesLabel: string;
    tournamentApertura: string;
    excludeTeamsLabel: (excluded: number, total: number) => string;
    excludedStatus: (n: number) => string;
    filterClubsTitle: (n: number, total: number) => string;
    all: string;
    none: string;
    apply: string;
    filterTeamPlaceholder: string;
    selectedCount: (n: number, total: number) => string;
    benchmarkTitle: string;
    vsAllTeams: string;
    vsOwnTeam: string;
    vsTargetTier: string;
    targetTierLabel: string;
    targetGroups: {
      top6: string;
      lima: string;
      altitude: string;
      provincial: string;
    };
    metricsSectionTitle: string;
    resetPreset: (roleLabel?: string | null) => string;
    resetPresetTitle: (roleLabel?: string | null) => string;
    xAxis: string;
    yAxis: string;
    beeswarm: (idx: 1 | 2 | 3) => string;
    positionPlayerSlicesTitle: string;
    positionGroupLabel: string;
    positionGroups: Record<string, string>;
    playerLabel: string;
    loading: string;
    searchPlayerPlaceholder: string;
    searching: string;
    noPlayersFound: string;
    unknownPosition: string;
    radarSlicesLabel: (active: number, total: number) => string;
    slicesSelected: (n: number) => string;
    toggleSlices: string;
    allSlices: string;
    noneSlices: string;
  };
  floor1: {
    position: string;
    age: string;
    minutes: string;
    country: string;
    shirtNumber: string;
    league: string;
    roles: Record<string, string>;
    countries: Record<string, string>;
    cohortAbbr: Record<string, string>;
    cohortPlural: Record<string, string>;
    playersPlural: string;
    lowConfidenceTooltip: string;
    top10Suffix: string;
    loadingRankings: string;
    noRankingsFound: string;
    timeInPositionTitle: string;
    minutesAcrossPositions: (mins: string, count: number) => string;
    noPositionalData: string;
    posAbbr: Record<string, string>;
  };
  floor2: {
    mostSimilarTo: (name: string) => string;
    closestSubtitle: (pos: string, count: number) => string;
    noSimilarFound: string;
    shotsTitle: string;
    shotsSubtitle: (shots: number, goals: number, xg: string) => string;
    goal: string;
    noGoal: string;
    chancesTitle: string;
    chancesSubtitle: (big: number, chances: number, assists: number) => string;
    openPlay: string;
    cross: string;
    setPlay: string;
    assist: string;
    chanceTypes: Record<string, string>;
    chanceRecipients: Record<string, string>;
    takeOnsTitle: string;
    takeOnsSubtitle: (succ: number, total: number, pct: number) => string;
    successful: string;
    unsuccessful: string;
    takeOnFallback: string;
    passStartsTitle: string;
    openPlayPasses: (n: number) => string;
    passEndingsTitle: string;
    openPlayPassEndpoints: (n: number) => string;
    heatmapTitle: string;
    openPlayActions: (n: number) => string;
  };
  floor3: {
    ageLabel: string;
    minLabel: string;
    playerFallback: string;
    defendingTitle: string;
    defendingSubtitle: (total: number, tackles: number, rec: number, aerial: number) => string;
  };
  export: {
    downloadPng: string;
    generatingPng: string;
    downloadPdf: string;
    generatingPdf: string;
    pngError: string;
    pdfError: string;
  };
  metrics: Record<string, MetricTranslation>;
}

export const TRANSLATIONS: Record<ScoutingLang, ScoutingTranslations> = {
  es: {
    headerTitle: 'Plantilla Interactiva de Informe de Scouting',
    config: {
      dataConfigTitle: 'Configuración de Datos',
      minAge: 'Edad mín.:',
      maxAge: 'Edad máx.:',
      leaguesLabel: 'Ligas (filtrar universo de jugadores)',
      tournamentApertura: 'Torneo Apertura',
      excludeTeamsLabel: (excluded, total) => `Equipos a excluir (${excluded}/${total})`,
      excludedStatus: (n) =>
        n > 0 ? `${n} ${n === 1 ? 'equipo excluido' : 'equipos excluidos'}` : 'Sin equipos excluidos',
      filterClubsTitle: (n, total) => `Filtrar Clubes (${n}/${total})`,
      all: 'Todos',
      none: 'Ninguno',
      apply: 'Aplicar',
      filterTeamPlaceholder: 'filtrar nombre de club...',
      selectedCount: (n, total) => `${n} de ${total} seleccionados`,
      benchmarkTitle: 'Modo de Comparación y Grupo Objetivo',
      vsAllTeams: 'vs todos los equipos',
      vsOwnTeam: 'vs propio club',
      vsTargetTier: 'vs nivel objetivo →',
      targetTierLabel: 'Nivel / grupo objetivo',
      targetGroups: {
        top6: "Top 6 Clubes (Candidatos: 'U', Alianza, Cristal, Melgar, Cusco, Cienciano)",
        lima: "Clubes de Lima (Alianza, 'U', Cristal, Sport Boys)",
        altitude: 'Clubes de Altura (Sierra: Melgar, Cienciano, Cusco, ADT, Huancayo)',
        provincial: 'Clubes de Provincia (Fuera de Lima)',
      },
      metricsSectionTitle: 'Métricas de Dispersión y Distribuciones Beeswarm',
      resetPreset: (roleLabel) => `Restablecer preset${roleLabel ? ` (${roleLabel})` : ''}`,
      resetPresetTitle: (roleLabel) =>
        roleLabel ? `Restablecer métricas sugeridas para ${roleLabel}` : 'Restablecer métricas por defecto',
      xAxis: 'Eje X',
      yAxis: 'Eje Y',
      beeswarm: (idx) => `Distribución ${idx}`,
      positionPlayerSlicesTitle: 'Posición, Jugador y Métricas del Radar',
      positionGroupLabel: 'Grupo de posición',
      positionGroups: {
        'All Positions': 'Todas las posiciones',
        Defender: 'Defensa',
        Midfielder: 'Mediocampista',
        Forward: 'Delantero',
        Goalkeeper: 'Arquero',
      },
      playerLabel: 'Jugador',
      loading: 'Cargando...',
      searchPlayerPlaceholder: 'Buscar nombre de jugador...',
      searching: 'Buscando...',
      noPlayersFound: 'No se encontraron jugadores',
      unknownPosition: 'Desconocido',
      radarSlicesLabel: (active, total) => `Métricas del radar (${active}/${total})`,
      slicesSelected: (n) => `${n} ${n === 1 ? 'métrica activa' : 'métricas activas'}`,
      toggleSlices: 'Alternar Métricas',
      allSlices: 'Todas',
      noneSlices: 'Ninguna',
    },
    floor1: {
      position: 'Posición',
      age: 'Edad',
      minutes: 'Minutos',
      country: 'País',
      shirtNumber: 'Dorsal',
      league: 'Liga',
      roles: {
        'Full Back': 'Lateral',
        'Centre Back': 'Defensa Central',
        'Defensive Mid': 'Med. Defensivo',
        'Defensive Midfielder': 'Med. Defensivo',
        'Central Mid': 'Mediocentro',
        'Central Midfielder': 'Mediocentro',
        'Attacking Mid': 'Mediapunta',
        'Attacking Midfielder': 'Mediapunta',
        'Wide/AM': 'Extremo / MCO',
        Striker: 'Delantero Centro',
        Defender: 'Defensa',
        Midfielder: 'Mediocampista',
        Forward: 'Delantero',
        Goalkeeper: 'Arquero',
      },
      countries: {
        peru: 'Perú',
        argentina: 'Argentina',
        uruguay: 'Uruguay',
        brazil: 'Brasil',
        colombia: 'Colombia',
        chile: 'Chile',
        ecuador: 'Ecuador',
        paraguay: 'Paraguay',
        venezuela: 'Venezuela',
        bolivia: 'Bolivia',
        spain: 'España',
        mexico: 'México',
        'united states': 'Estados Unidos',
      },
      cohortAbbr: {
        'Full Back': 'Laterales',
        'Centre Back': 'Centrales',
        'Defensive Mid': 'MCDs',
        'Central Mid': 'Mediocentros',
        'Attacking Mid': 'Mediapuntas',
      },
      cohortPlural: {
        Defender: 'Defensas',
        D: 'Defensas',
        Midfielder: 'Mediocampistas',
        M: 'Mediocampistas',
        Forward: 'Delanteros',
        F: 'Delanteros',
        Goalkeeper: 'Arqueros',
        G: 'Arqueros',
      },
      playersPlural: 'Jugadores',
      lowConfidenceTooltip: 'Cohorte pequeño o muchos ceros: percentil poco estable',
      top10Suffix: 'Top 10',
      loadingRankings: 'Cargando ranking...',
      noRankingsFound: 'Sin datos de ranking.',
      timeInPositionTitle: 'Minutos por Posición',
      minutesAcrossPositions: (mins, count) =>
        `${mins} minutos en ${count} ${count === 1 ? 'posición' : 'posiciones'}`,
      noPositionalData: 'Sin datos posicionales disponibles.',
      posAbbr: {
        GK: 'POR',
        G: 'POR',
        LB: 'LI',
        LCB: 'DFC',
        CB: 'DFC',
        CD: 'DFC',
        D: 'DFC',
        RCB: 'DFC',
        RB: 'LD',
        LWB: 'CAI',
        RWB: 'CAD',
        LDM: 'MCD',
        CDM: 'MCD',
        DM: 'MCD',
        RDM: 'MCD',
        LM: 'MI',
        LCM: 'MC',
        CM: 'MC',
        M: 'MC',
        RCM: 'MC',
        RM: 'MD',
        LAM: 'MCO',
        CAM: 'MCO',
        AM: 'MCO',
        RAM: 'MCO',
        LW: 'EI',
        LS: 'DC',
        CF: 'DC',
        ST: 'DC',
        F: 'DC',
        RS: 'DC',
        RW: 'ED',
      },
    },
    floor2: {
      mostSimilarTo: (name) => `Más similares a ${name}`,
      closestSubtitle: (pos, count) => `15 más cercanos en ${pos} · ${count} métricas`,
      noSimilarFound: 'No se encontraron jugadores similares.',
      shotsTitle: 'Tiros',
      shotsSubtitle: (shots, goals, xg) => `${shots} Tiros · ${goals} Goles · ${xg} xG`,
      goal: 'Gol',
      noGoal: 'Sin gol',
      chancesTitle: 'Ocasiones',
      chancesSubtitle: (big, chances, assists) => `${big} Claras · ${chances} Ocasiones · ${assists} Asist.`,
      openPlay: 'J. Abierto',
      cross: 'Centro',
      setPlay: 'B. Parado',
      assist: 'Asist.',
      chanceTypes: {
        'Open Play': 'J. Abierto',
        Cross: 'Centro',
        'Set Play': 'B. Parado',
      },
      chanceRecipients: {
        Goal: 'Gol',
        'Shot on Target': 'Tiro a puerta',
        'Key Pass': 'Pase clave',
        'Through Ball': 'Pase filtrado',
        Pass: 'Pase',
        Cross: 'Centro',
        Cutback: 'Pase atrás',
        Corner: 'Córner',
      },
      takeOnsTitle: 'Regates',
      takeOnsSubtitle: (succ, total, pct) => `${succ}/${total} exitosos · ${pct}%`,
      successful: 'Exitoso',
      unsuccessful: 'Fallido',
      takeOnFallback: 'Regate',
      passStartsTitle: 'Inicio de Pases',
      openPlayPasses: (n) => `${n} Pases en Juego Abierto`,
      passEndingsTitle: 'Destino de Pases',
      openPlayPassEndpoints: (n) => `${n} Destinos en Juego Abierto`,
      heatmapTitle: 'Mapa de Calor',
      openPlayActions: (n) => `${n} Acciones en Juego Abierto`,
    },
    floor3: {
      ageLabel: 'Edad',
      minLabel: 'Min',
      playerFallback: 'Jugador',
      defendingTitle: 'Acciones Defensivas',
      defendingSubtitle: (total, tackles, rec, aerial) =>
        `${total} total · ${tackles} Entradas · ${rec} Recup. · ${aerial} Aéreos`,
    },
    export: {
      downloadPng: 'Descargar PNG',
      generatingPng: 'Generando PNG...',
      downloadPdf: 'Descargar PDF',
      generatingPdf: 'Generando PDF...',
      pngError: 'No se pudo generar la exportación PNG. Inténtalo de nuevo.',
      pdfError: 'No se pudo generar la exportación PDF. Inténtalo de nuevo.',
    },
    metrics: {
      goals: {
        short: 'Goles',
        long: 'Goles',
        radarSplit: ['Goles', null],
      },
      expected_goals: {
        short: 'Goles esp. (xG)',
        long: 'Goles Esperados (xG)',
        radarSplit: ['Goles', 'esp. (xG)'],
      },
      shots_on_target: {
        short: 'Tiros a Puerta',
        long: 'Tiros a Puerta',
        radarSplit: ['Tiros a', 'Puerta'],
      },
      big_chances_missed: {
        short: 'Ocasiones Falladas',
        long: 'Ocasiones Claras Falladas',
        radarSplit: ['Ocasiones', 'Falladas'],
      },
      assists: {
        short: 'Asistencias',
        long: 'Asistencias',
        radarSplit: ['Asistencias', null],
      },
      key_passes: {
        short: 'Pases Clave',
        long: 'Pases Clave',
        radarSplit: ['Pases', 'Clave'],
      },
      big_chances_created: {
        short: 'Ocasiones Creadas',
        long: 'Ocasiones Claras Creadas',
        radarSplit: ['Ocasiones', 'Creadas'],
      },
      accurate_passes_percentage: {
        short: 'Precisión Pases',
        long: 'Precisión de Pases %',
        radarSplit: ['Precisión', 'Pases %'],
      },
      accurate_final_third_passes: {
        short: 'Pases Últ. Tercio',
        long: 'Pases en Último Tercio',
        radarSplit: ['Pases Últ.', 'Tercio'],
      },
      accurate_crosses: {
        short: 'Centros Precisos',
        long: 'Centros Precisos',
        radarSplit: ['Centros', 'Precisos'],
      },
      successful_dribbles: {
        short: 'Regates',
        long: 'Regates Completados',
        radarSplit: ['Regates', null],
      },
      successful_dribbles_percentage: {
        short: 'Éxito Regates %',
        long: 'Éxito en Regates %',
        radarSplit: ['Éxito', 'Regates %'],
      },
      ground_duels_won_percentage: {
        short: 'Duelos Suelo %',
        long: 'Duelos en Suelo %',
        radarSplit: ['Duelos', 'Suelo %'],
      },
      aerial_duels_won: {
        short: 'Duelos Aéreos',
        long: 'Duelos Aéreos Ganados',
        radarSplit: ['Duelos', 'Aéreos'],
      },
      tackles: {
        short: 'Entradas',
        long: 'Entradas',
        radarSplit: ['Entradas', null],
      },
      interceptions: {
        short: 'Intercepciones',
        long: 'Intercepciones',
        radarSplit: ['Intercepciones', null],
      },
      clearances: {
        short: 'Despejes',
        long: 'Despejes',
        radarSplit: ['Despejes', null],
      },
    },
  },
  en: {
    headerTitle: 'Interactive Scouting Report Template',
    config: {
      dataConfigTitle: 'Data Configuration',
      minAge: 'Min age:',
      maxAge: 'Max age:',
      leaguesLabel: "Leagues (filter who's in the pool)",
      tournamentApertura: 'Torneo Apertura',
      excludeTeamsLabel: (excluded, total) => `Teams to exclude (${excluded}/${total})`,
      excludedStatus: (n) =>
        n > 0 ? `${n} ${n === 1 ? 'team' : 'teams'} excluded` : 'No teams excluded',
      filterClubsTitle: (n, total) => `Filter Clubs (${n}/${total})`,
      all: 'All',
      none: 'None',
      apply: 'Apply',
      filterTeamPlaceholder: 'filter team name...',
      selectedCount: (n, total) => `${n} of ${total} selected`,
      benchmarkTitle: 'Benchmark Mode & Target League',
      vsAllTeams: 'vs all teams',
      vsOwnTeam: 'vs own team',
      vsTargetTier: 'vs target tier →',
      targetTierLabel: 'Target tier / group',
      targetGroups: {
        top6: "Top 6 Clubs (Title Contenders: 'U', Alianza, Cristal, Melgar, Cusco, Cienciano)",
        lima: "Lima Powerhouses (Alianza, 'U', Cristal, Sport Boys)",
        altitude: 'Altitude Clubs (Sierra: Melgar, Cienciano, Cusco, ADT, Huancayo)',
        provincial: 'Provincial Clubs (Outside Lima)',
      },
      metricsSectionTitle: 'Metrics for Scatterplot & Beeswarm Distributions',
      resetPreset: (roleLabel) => `Reset preset${roleLabel ? ` (${roleLabel})` : ''}`,
      resetPresetTitle: (roleLabel) =>
        roleLabel ? `Reset suggested metrics for ${roleLabel}` : 'Reset default metrics',
      xAxis: 'X axis',
      yAxis: 'Y axis',
      beeswarm: (idx) => `Beeswarm ${idx}`,
      positionPlayerSlicesTitle: 'Select Position, Player & Slices',
      positionGroupLabel: 'Position group',
      positionGroups: {
        'All Positions': 'All Positions',
        Defender: 'Defender',
        Midfielder: 'Midfielder',
        Forward: 'Forward',
        Goalkeeper: 'Goalkeeper',
      },
      playerLabel: 'Player',
      loading: 'Loading...',
      searchPlayerPlaceholder: 'Search player name...',
      searching: 'Searching...',
      noPlayersFound: 'No players found',
      unknownPosition: 'Unknown',
      radarSlicesLabel: (active, total) => `Radar slices (${active}/${total})`,
      slicesSelected: (n) => `${n} ${n === 1 ? 'slice' : 'slices'} selected`,
      toggleSlices: 'Toggle Slices',
      allSlices: 'All',
      noneSlices: 'None',
    },
    floor1: {
      position: 'Position',
      age: 'Age',
      minutes: 'Minutes',
      country: 'Country',
      shirtNumber: 'Shirt #',
      league: 'League',
      roles: {
        'Full Back': 'Full Back',
        'Centre Back': 'Centre Back',
        'Defensive Mid': 'Defensive Midfielder',
        'Defensive Midfielder': 'Defensive Midfielder',
        'Central Mid': 'Central Midfielder',
        'Central Midfielder': 'Central Midfielder',
        'Attacking Mid': 'Attacking Midfielder',
        'Attacking Midfielder': 'Attacking Midfielder',
        'Wide/AM': 'Wide/AM',
        Striker: 'Striker',
        Defender: 'Defender',
        Midfielder: 'Midfielder',
        Forward: 'Forward',
        Goalkeeper: 'Goalkeeper',
      },
      countries: {
        peru: 'Peru',
        argentina: 'Argentina',
        uruguay: 'Uruguay',
        brazil: 'Brazil',
        colombia: 'Colombia',
        chile: 'Chile',
        ecuador: 'Ecuador',
        paraguay: 'Paraguay',
        venezuela: 'Venezuela',
        bolivia: 'Bolivia',
        spain: 'Spain',
        mexico: 'Mexico',
        'united states': 'United States',
      },
      cohortAbbr: {
        'Full Back': 'FBs',
        'Centre Back': 'CBs',
        'Defensive Mid': 'DMs',
        'Central Mid': 'CMs',
        'Attacking Mid': 'AMs',
      },
      cohortPlural: {
        Defender: 'Defenders',
        D: 'Defenders',
        Midfielder: 'Midfielders',
        M: 'Midfielders',
        Forward: 'Forwards',
        F: 'Forwards',
        Goalkeeper: 'Goalkeepers',
        G: 'Goalkeepers',
      },
      playersPlural: 'Players',
      lowConfidenceTooltip: 'Small cohort or many zeros: unstable percentile',
      top10Suffix: 'Top 10',
      loadingRankings: 'Loading rankings...',
      noRankingsFound: 'No rankings found.',
      timeInPositionTitle: 'Time in Position',
      minutesAcrossPositions: (mins, count) =>
        `${mins} minutes across ${count} ${count === 1 ? 'position' : 'positions'}`,
      noPositionalData: 'No positional data available.',
      posAbbr: {
        GK: 'GK',
        G: 'GK',
        LB: 'LB',
        LCB: 'CB',
        CB: 'CB',
        CD: 'CB',
        D: 'CB',
        RCB: 'CB',
        RB: 'RB',
        LWB: 'LWB',
        RWB: 'RWB',
        LDM: 'DM',
        CDM: 'DM',
        DM: 'DM',
        RDM: 'DM',
        LM: 'LM',
        LCM: 'CM',
        CM: 'CM',
        M: 'CM',
        RCM: 'CM',
        RM: 'RM',
        LAM: 'CAM',
        CAM: 'CAM',
        AM: 'CAM',
        RAM: 'CAM',
        LW: 'LW',
        LS: 'ST',
        CF: 'ST',
        ST: 'ST',
        F: 'ST',
        RS: 'ST',
        RW: 'RW',
      },
    },
    floor2: {
      mostSimilarTo: (name) => `Most similar to ${name}`,
      closestSubtitle: (pos, count) => `15 closest in ${pos} · ${count} metrics`,
      noSimilarFound: 'No similar players found.',
      shotsTitle: 'Shots',
      shotsSubtitle: (shots, goals, xg) => `${shots} Shots · ${goals} Goals · ${xg} xG`,
      goal: 'Goal',
      noGoal: 'No goal',
      chancesTitle: 'Chances',
      chancesSubtitle: (big, chances, assists) => `${big} Big Chances · ${chances} Chances · ${assists} Assists`,
      openPlay: 'Open Play',
      cross: 'Cross',
      setPlay: 'Set Play',
      assist: 'Assist',
      chanceTypes: {
        'Open Play': 'Open Play',
        Cross: 'Cross',
        'Set Play': 'Set Play',
      },
      chanceRecipients: {
        Goal: 'Goal',
        'Shot on Target': 'Shot on Target',
        'Key Pass': 'Key Pass',
        'Through Ball': 'Through Ball',
        Pass: 'Pass',
        Cross: 'Cross',
        Cutback: 'Cutback',
        Corner: 'Corner',
      },
      takeOnsTitle: 'Take-ons',
      takeOnsSubtitle: (succ, total, pct) => `${succ}/${total} successful · ${pct}%`,
      successful: 'Successful',
      unsuccessful: 'Unsuccessful',
      takeOnFallback: 'Take-on',
      passStartsTitle: 'Pass Starts',
      openPlayPasses: (n) => `${n} Open Play Passes`,
      passEndingsTitle: 'Pass Endings',
      openPlayPassEndpoints: (n) => `${n} Open Play Pass Endpoints`,
      heatmapTitle: 'Heatmap',
      openPlayActions: (n) => `${n} Open Play Actions`,
    },
    floor3: {
      ageLabel: 'Age',
      minLabel: 'Min',
      playerFallback: 'Player',
      defendingTitle: 'Defending',
      defendingSubtitle: (total, tackles, rec, aerial) =>
        `${total} total · ${tackles} Tackles · ${rec} Recoveries · ${aerial} Aerial`,
    },
    export: {
      downloadPng: 'Download PNG',
      generatingPng: 'Generating PNG...',
      downloadPdf: 'Download PDF',
      generatingPdf: 'Generating PDF...',
      pngError: 'Could not generate PNG export. Please try again.',
      pdfError: 'Could not generate PDF export. Please try again.',
    },
    metrics: {
      goals: {
        short: 'Goals',
        long: 'Goals',
        radarSplit: ['Goals', null],
      },
      expected_goals: {
        short: 'Expected Goals',
        long: 'Expected Goals (xG)',
        radarSplit: ['Expected', 'Goals (xG)'],
      },
      shots_on_target: {
        short: 'Shots on Target',
        long: 'Shots On Target',
        radarSplit: ['Shots on', 'Target'],
      },
      big_chances_missed: {
        short: 'Big Chances Missed',
        long: 'Big Chances Missed',
        radarSplit: ['Big Chances', 'Missed'],
      },
      assists: {
        short: 'Assists',
        long: 'Assists',
        radarSplit: ['Assists', null],
      },
      key_passes: {
        short: 'Key Passes',
        long: 'Key Passes',
        radarSplit: ['Key', 'Passes'],
      },
      big_chances_created: {
        short: 'Big Chances Created',
        long: 'Big Chances Created',
        radarSplit: ['Big Chances', 'Created'],
      },
      accurate_passes_percentage: {
        short: 'Pass Accuracy',
        long: 'Pass Accuracy %',
        radarSplit: ['Pass Acc', '%'],
      },
      accurate_final_third_passes: {
        short: 'Final 3rd Passes',
        long: 'Final 3rd Passes',
        radarSplit: ['Final 3rd', 'Passes'],
      },
      accurate_crosses: {
        short: 'Accurate Crosses',
        long: 'Accurate Crosses',
        radarSplit: ['Accurate', 'Crosses'],
      },
      successful_dribbles: {
        short: 'Dribbles',
        long: 'Completed Dribbles',
        radarSplit: ['Dribbles', null],
      },
      successful_dribbles_percentage: {
        short: 'Dribble Success %',
        long: 'Dribble Success %',
        radarSplit: ['Dribble', 'Success %'],
      },
      ground_duels_won_percentage: {
        short: 'Ground Duels %',
        long: 'Ground Duels %',
        radarSplit: ['Ground', 'Duels %'],
      },
      aerial_duels_won: {
        short: 'Aerial Duels',
        long: 'Aerial Duels Won',
        radarSplit: ['Aerial', 'Duels'],
      },
      tackles: {
        short: 'Tackles',
        long: 'Tackles',
        radarSplit: ['Tackles', null],
      },
      interceptions: {
        short: 'Interceptions',
        long: 'Interceptions',
        radarSplit: ['Interceptions', null],
      },
      clearances: {
        short: 'Clearances',
        long: 'Clearances',
        radarSplit: ['Clearances', null],
      },
    },
  },
};

export function useScoutingLanguage(defaultLang: ScoutingLang = 'es') {
  const [lang, setLangState] = useState<ScoutingLang>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'en' || saved === 'es' ? saved : defaultLang;
    } catch {
      return defaultLang;
    }
  });

  const setLang = useCallback((next: ScoutingLang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage errors
    }
  }, []);

  return { lang, setLang, t: TRANSLATIONS[lang] };
}
