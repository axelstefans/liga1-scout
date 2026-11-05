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
  matchSheet01: MatchSheet01Translations;
  matchSheet03: MatchSheet03Translations;
}

export interface MatchSheet03Translations {
  friezeLeft: string;
  friezeRight: string;
  title: string;
  subtitle: string;
  venue: {
    stadium: string;
    altitude: string;
    surface: string;
    referee: string;
    smallSample: string;
    unavailable: string;
  };
  gameState: {
    title: string;
    regulationTime: string;
    lead: string;
    draw: string;
    trail: string;
    noGoals: string;
  };
  halves: {
    title: string;
    firstHalf: string;
    secondHalf: string;
    xg: string;
    goals: string;
    corners: string;
    fouls: string;
    yellowCards: string;
    possession: string;
    shots: string;
    shotsTotal: string;
    shotsOnTarget: string;
  };
  attackChannels: {
    title: string;
    subtitle: string;
    left: string;
    center: string;
    right: string;
  };
  shotTypology: {
    title: string;
    openPlay: string;
    setPiece: string;
    counterAttack: string;
    penalty: string;
    other: string;
    total: string;
  };
}

export interface MatchSheet01Translations {
  friezeLeft: string;
  friezeRight: string;
  title: string;
  subtitle: (tournament: string, round: number | null, dateStr: string) => string;
  conceptualSubtitle: string;
  months: string[];
  kpis: {
    xg: { label: string; sublabel: string };
    xgot: { label: string; sublabel: string };
    shots: { label: string; sublabel: string };
    onTarget: { label: string; sublabel: string };
  };
  module01: {
    number: string;
    title: string;
    subtitle: string;
    editorialTitle: string;
    editorialSubtitle: string;
    xAxisLabel: string;
    yAxisLabel: string;
    stoppageSuffix: string;
    axisNote: string;
    empty: string;
    ownGoalTag: string;
    penTag: string;
  };
  module02: {
    number: string;
    title: string;
    subtitle: string;
    scaleNote: string;
    empty: string;
    fieldTiltLabel: string;
    deepCompletionsLabel: string;
    metrics: {
      goals: string;
      xgPerShot: string;
      bigChances: string;
      boxEntries: string;
      fieldTilt: string;
      deepCompletions: string;
    };
  };
  module0304: {
    homeNumber: string;
    awayNumber: string;
    shotMapTitle: (teamName: string) => string;
    shotMapSubtitle: string;
    attacksRight: string;
    densityLabel: string;
    densityUnavailable: string;
    legendGoal: string;
    legendSaved: string;
    legendBlocked: string;
    legendOffTarget: string;
    legendOwnHalf: string;
    legendSize: string;
    emptyShots: string;
  };
  module05: {
    number: string;
    title: string;
    subtitle: string;
    yAxisLabel: string;
    stops: {
      created: string;
      onFrame: string;
      struck: string;
      scored: string;
    };
    editorialStops: {
      created: string;
      onFrame: string;
      struck: string;
      scored: string;
    };
    xgotMissingNote: string;
    ownGoalNote: (n: number) => string;
    empty: string;
  };
  module06: {
    number: string;
    title: string;
    subtitle: string;
    xAxisLabel: string;
    tieOffsetNote: string;
    categories: {
      goals: string;
      saved: string;
      blocked: string;
      offTarget: string;
    };
    woodworkBadge: (n: number) => string;
    empty: string;
  };
  footer: {
    dataSource: string;
    copyright: string;
    exportButton: string;
    exportingButton: string;
    selectMatchPrompt: string;
    loadingSheet: string;
    errorTitle: string;
    retryButton: string;
    noData: string;
    modelEstimates: string;
  };
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
    matchSheet01: {
      friezeLeft: 'TACTICAL / MATCH ANALYSIS',
      friezeRight: '01 / 03',
      title: 'Resultado y ocasiones',
      subtitle: (tournament, round, dateStr) =>
        `Liga 1 2026 · Torneo ${tournament}${round ? ` · Fecha ${round}` : ''}${dateStr ? ` · ${dateStr}` : ''}`,
      conceptualSubtitle: 'De dónde vinieron los goles y si la calidad de las ocasiones correspondió al marcador.',
      months: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
      kpis: {
        xg: { label: 'EXPECTED GOALS', sublabel: '' },
        xgot: { label: 'EXPECTED GOALS ON TARGET', sublabel: '' },
        shots: { label: 'SHOTS', sublabel: '' },
        onTarget: { label: 'ON TARGET', sublabel: '' },
      },
      module01: {
        number: '01',
        title: 'Flujo de xG',
        subtitle: 'Evolución acumulada minuto a minuto',
        editorialTitle: 'Expected goals through the match',
        editorialSubtitle: 'xG acumulado por tiro | cada escalón es un remate | minuto del evento',
        xAxisLabel: 'Minuto de juego',
        yAxisLabel: 'xG acumulado',
        stoppageSuffix: 'añadido',
        axisNote: "Eje X: 0' a 90'+ (añadido y goles en descuento escalonados cronológicamente)",
        empty: 'Sin flujo de xG registrado para este encuentro',
        ownGoalTag: 'AG',
        penTag: 'PEN',
      },
      module02: {
        number: '02',
        title: 'Chance balance',
        subtitle: 'Two bars per metric; shared scale within each row; — = unavailable',
        scaleNote: 'Escala normalizada por fila · Local (sólido) vs Visitante (tramado)',
        empty: 'Sin métricas de balance disponibles',
        fieldTiltLabel: 'Field tilt',
        deepCompletionsLabel: 'Deep completions',
        metrics: {
          goals: 'Goals',
          xgPerShot: 'xG per shot',
          bigChances: 'Big chances',
          boxEntries: 'Box entries',
          fieldTilt: 'Field tilt',
          deepCompletions: 'Deep completions',
        },
      },
      module0304: {
        homeNumber: '03',
        awayNumber: '04',
        shotMapTitle: (teamName) => `${teamName} · tiros`,
        shotMapSubtitle: 'Área de punto = xG del tiro; estrellas = goles; sombreado = densidad de toques | ataca →',
        attacksRight: 'Ataca →',
        densityLabel: 'Densidad: acciones con balón en campo rival (6×5)',
        densityUnavailable: 'Densidad espacial no disponible',
        legendGoal: '★ Gol',
        legendSaved: 'Atajado',
        legendBlocked: 'Bloqueado',
        legendOffTarget: 'Fuera / Poste',
        legendOwnHalf: "Borde punteado: tiro desde campo propio (anclado en x'=50)",
        legendSize: 'Radio ∝ √(xG)',
        emptyShots: 'Sin tiros registrados',
      },
      module05: {
        number: '05',
        title: 'De la ocasión al gol',
        subtitle: 'Pre-shot xG, the share that reached the frame, its post-shot value, and goals',
        yAxisLabel: 'Goles esperados / goles',
        stops: {
          created: 'Created',
          onFrame: 'On frame',
          struck: 'Struck',
          scored: 'Scored',
        },
        editorialStops: {
          created: 'Created',
          onFrame: 'On frame',
          struck: 'Struck',
          scored: 'Scored',
        },
        xgotMissingNote: 'Parada Struck (xGOT) sin tramo: partido sin cobertura post-tiro',
        ownGoalNote: (n) => `Incluye ${n} autogol(es) a favor`,
        empty: 'Sin datos de conversión disponibles',
      },
      module06: {
        number: '06',
        title: 'Resultados de los tiros',
        subtitle: 'Recorded outcome counts | both teams use the same shot-count axis',
        xAxisLabel: 'Tiros',
        tieOffsetNote: 'Valores iguales desfasados verticalmente',
        categories: {
          goals: 'Goals',
          saved: 'Saved',
          blocked: 'Blocked',
          offTarget: 'Off target',
        },
        woodworkBadge: (n) => `Postes: ${n}`,
        empty: 'Sin desenlaces de tiro registrados',
      },
      footer: {
        dataSource:
          'Fuentes: SofaScore (coordenadas, xG calculado y eventos espaciales) · Flashscore (xGOT y grandes ocasiones)',
        copyright: 'LIGA 1 PERÚ · UNIDAD DE ANÁLISIS TÁCTICO Y SCOUTING EDITORIAL',
        exportButton: 'Exportar PNG',
        exportingButton: 'Exportando...',
        selectMatchPrompt: 'Selecciona un partido jugado en el selector superior para visualizar la Lámina 01 / 03.',
        loadingSheet: 'Construyendo Lámina 01 / 03 — Resultado y ocasiones...',
        errorTitle: 'Error al consultar el reporte del partido seleccionado',
        retryButton: 'Reintentar',
        noData: 'No se registran datos tácticos para el partido seleccionado.',
        modelEstimates: 'Local model values are estimates',
      },
    },
    matchSheet03: {
      friezeLeft: 'LIGA 1 TE APUESTO · REPORTE DE PARTIDO',
      friezeRight: 'LÁMINA 03 / 03',
      title: 'Match statistics and performance data hub',
      subtitle: 'Consolidación métrica exhaustiva comparando datos de eventos de Sofascore y Flashscore.',
      venue: {
        stadium: 'Estadio',
        altitude: 'm s. n. m.',
        surface: 'Superficie',
        referee: 'Árbitro',
        smallSample: 'muestra pequeña',
        unavailable: '—',
      },
      gameState: {
        title: 'CRONOLOGÍA DE GOLES Y ESTADO DE JUEGO',
        regulationTime: '90 min reglamentarios',
        lead: 'Ventaja',
        draw: 'Empate',
        trail: 'Desventaja',
        noGoals: 'Sin goles en el partido',
      },
      halves: {
        title: 'DESGLOSE POR MITADES (1T / 2T)',
        firstHalf: '1T · PRIMER TIEMPO',
        secondHalf: '2T · SEGUNDO TIEMPO',
        xg: 'xG',
        goals: 'Goles',
        corners: 'Córners',
        fouls: 'Faltas',
        yellowCards: 'Amarillas',
        possession: 'Posesión',
        shots: 'Tiros',
        shotsTotal: 'Tiros Totales',
        shotsOnTarget: 'Tiros a Puerta',
      },
      attackChannels: {
        title: 'CANALES DE ATAQUE',
        subtitle: 'Pases completados en último tercio (x ≥ 66.7)',
        left: 'Banda Izquierda',
        center: 'Pasillo Central',
        right: 'Banda Derecha',
      },
      shotTypology: {
        title: 'TIPOLOGÍA DE REMATES',
        openPlay: 'Jugada abierta',
        setPiece: 'Balón parado',
        counterAttack: 'Contraataque',
        penalty: 'Penalti',
        other: 'Otros',
        total: 'Total remates',
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
    matchSheet01: {
      friezeLeft: 'TACTICAL / MATCH ANALYSIS',
      friezeRight: '01 / 03',
      title: 'The result and the chances',
      subtitle: (tournament, round, dateStr) =>
        `Liga 1 2026 · ${tournament} Tournament${round ? ` · Round ${round}` : ''}${dateStr ? ` · ${dateStr}` : ''}`,
      conceptualSubtitle: 'Where the goals came from and whether the chance quality matched the scoreline.',
      months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      kpis: {
        xg: { label: 'EXPECTED GOALS', sublabel: '' },
        xgot: { label: 'EXPECTED GOALS ON TARGET', sublabel: '' },
        shots: { label: 'SHOTS', sublabel: '' },
        onTarget: { label: 'ON TARGET', sublabel: '' },
      },
      module01: {
        number: '01',
        title: 'xG flow',
        subtitle: 'Cumulative minute-by-minute progression',
        editorialTitle: 'Expected goals through the match',
        editorialSubtitle: 'Cumulative shot xG | each step is one attempt | elapsed event minute',
        xAxisLabel: 'Elapsed minute',
        yAxisLabel: 'Cumulative xG',
        stoppageSuffix: 'added',
        axisNote: "X-axis: 0' to 90'+ (stoppage time and added-time goals staggered chronologically)",
        empty: 'No xG flow recorded for this match',
        ownGoalTag: 'OG',
        penTag: 'PEN',
      },
      module02: {
        number: '02',
        title: 'Chance balance',
        subtitle: 'Two bars per metric; shared scale within each row; — = unavailable',
        scaleNote: 'Row-normalized scale · Home (solid) vs Away (hatched)',
        empty: 'No chance balance metrics available',
        fieldTiltLabel: 'Field tilt',
        deepCompletionsLabel: 'Deep completions',
        metrics: {
          goals: 'Goals',
          xgPerShot: 'xG per shot',
          bigChances: 'Big chances',
          boxEntries: 'Box entries',
          fieldTilt: 'Field tilt',
          deepCompletions: 'Deep completions',
        },
      },
      module0304: {
        homeNumber: '03',
        awayNumber: '04',
        shotMapTitle: (teamName) => `${teamName} · shots`,
        shotMapSubtitle: 'Point area = shot xG; stars = goals; shading = touch density | attacks →',
        attacksRight: 'Attacks →',
        densityLabel: 'Density: opponent-half ball actions (6×5)',
        densityUnavailable: 'Spatial density unavailable',
        legendGoal: '★ Goal',
        legendSaved: 'Saved',
        legendBlocked: 'Blocked',
        legendOffTarget: 'Off target / Post',
        legendOwnHalf: "Dashed rim: shot from own half (anchored at x'=50)",
        legendSize: 'Radius ∝ √(xG)',
        emptyShots: 'No shots recorded',
      },
      module05: {
        number: '05',
        title: 'From chance to goal',
        subtitle: 'Pre-shot xG, the share that reached the frame, its post-shot value, and goals',
        yAxisLabel: 'Expected goals / goals',
        stops: {
          created: 'Created',
          onFrame: 'On frame',
          struck: 'Struck',
          scored: 'Scored',
        },
        editorialStops: {
          created: 'Created',
          onFrame: 'On frame',
          struck: 'Struck',
          scored: 'Scored',
        },
        xgotMissingNote: 'Struck (xGOT) segment omitted: no post-shot coverage for this match',
        ownGoalNote: (n) => `Includes ${n} own goal(s) in favor`,
        empty: 'No conversion data available',
      },
      module06: {
        number: '06',
        title: 'Shot outcomes',
        subtitle: 'Recorded outcome counts | both teams use the same shot-count axis',
        xAxisLabel: 'Shots',
        tieOffsetNote: 'Equal values vertically offset',
        categories: {
          goals: 'Goals',
          saved: 'Saved',
          blocked: 'Blocked',
          offTarget: 'Off target',
        },
        woodworkBadge: (n) => `Woodwork: ${n}`,
        empty: 'No shot outcomes recorded',
      },
      footer: {
        dataSource:
          'Sources: SofaScore (coordinates, calculated xG & spatial events) · Flashscore (xGOT & big chances)',
        copyright: 'LIGA 1 PERU · TACTICAL ANALYSIS & EDITORIAL SCOUTING UNIT',
        exportButton: 'Export PNG',
        exportingButton: 'Exporting...',
        selectMatchPrompt: 'Select a played match in the top selector to view Sheet 01 / 03.',
        loadingSheet: 'Building Sheet 01 / 03 — The result and the chances...',
        errorTitle: 'Error fetching the selected match report',
        retryButton: 'Retry',
        noData: 'No tactical data recorded for the selected match.',
        modelEstimates: 'Local model values are estimates',
      },
    },
    matchSheet03: {
      friezeLeft: 'LIGA 1 TE APUESTO · MATCH REPORT',
      friezeRight: 'SHEET 03 / 03',
      title: 'Match statistics and performance data hub',
      subtitle: 'Comprehensive metric consolidation comparing Sofascore and Flashscore event data.',
      venue: {
        stadium: 'Stadium',
        altitude: 'm a.s.l.',
        surface: 'Surface',
        referee: 'Referee',
        smallSample: 'small sample',
        unavailable: '—',
      },
      gameState: {
        title: 'GOALS CHRONOLOGY & GAME STATE',
        regulationTime: '90 min regulation',
        lead: 'Lead',
        draw: 'Draw',
        trail: 'Trail',
        noGoals: 'No goals in match',
      },
      halves: {
        title: 'HALVES BREAKDOWN (1H / 2H)',
        firstHalf: '1H · FIRST HALF',
        secondHalf: '2H · SECOND HALF',
        xg: 'xG',
        goals: 'Goals',
        corners: 'Corners',
        fouls: 'Fouls',
        yellowCards: 'Yellow cards',
        possession: 'Possession',
        shots: 'Shots',
        shotsTotal: 'Total Shots',
        shotsOnTarget: 'Shots on Target',
      },
      attackChannels: {
        title: 'ATTACK CHANNELS',
        subtitle: 'Final third completed passes (x ≥ 66.7)',
        left: 'Left Flank',
        center: 'Central Channel',
        right: 'Right Flank',
      },
      shotTypology: {
        title: 'SHOT TYPOLOGY',
        openPlay: 'Open play',
        setPiece: 'Set piece',
        counterAttack: 'Counter attack',
        penalty: 'Penalty',
        other: 'Other',
        total: 'Total shots',
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
