import type React from 'react';
import type { PlayerSeasonStats } from '../../services/api';
import type {
  BeeswarmPoint,
  BeeswarmTick,
  BeeswarmStripData,
  BeeswarmHoverState,
  ScatterPoint,
} from './floor03/scoutingFloor03Utils';

export type {
  BeeswarmPoint,
  BeeswarmTick,
  BeeswarmStripData,
  BeeswarmHoverState,
  ScatterPoint,
};

export interface RadarMetricDef {
  key: string;
  pctKey: keyof PlayerSeasonStats;
  label: string;
  shortLabel: string;
  category: 'Attacking' | 'Passing' | 'Defending';
  color: string;
  hoverColor: string;
  isPercentage?: boolean;
}

export interface RoleMetricPreset {
  xAxis: string;
  yAxis: string;
  beeswarm1: string;
  beeswarm2: string;
  beeswarm3: string;
}

export interface PlayerNodeAvatarProps {
  playerId: number;
  name: string;
  isTarget?: boolean;
  ringClass?: string;
  targetRingColor?: string;
  ringColor?: string;
  sizeClass?: string;
  style?: React.CSSProperties;
  isHovered?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClick?: () => void;
}
