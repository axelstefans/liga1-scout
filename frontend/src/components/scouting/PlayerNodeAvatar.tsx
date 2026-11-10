import React, { useState } from 'react';
import type { PlayerNodeAvatarProps } from './scoutingTypes';

export const PlayerNodeAvatar: React.FC<PlayerNodeAvatarProps> = ({
  playerId,
  name,
  isTarget = false,
  ringClass = 'ring-2 ring-sky-500',
  targetRingColor,
  ringColor,
  sizeClass: customSizeClass,
  style: customStyle,
  isHovered = false,
  onMouseEnter,
  onMouseLeave,
  onClick,
}) => {
  const [imgError, setImgError] = useState(false);

  const sizeClass = customSizeClass || (isTarget ? 'w-7 h-7' : 'w-5.5 h-5.5');
  const defaultTargetRing = 'ring-2 ring-blue-700 ring-offset-1 ring-offset-white shadow-md';
  const effectiveRing = isTarget ? defaultTargetRing : ringClass;

  const activeColor = isTarget ? targetRingColor : ringColor;
  const avatarStyle: React.CSSProperties = {
    ...(isTarget
      ? {
          boxShadow: `0 0 0 2px #FFFFFF, 0 0 0 4px ${activeColor || '#1D4ED8'}, 0 2px 8px rgba(0,0,0,0.3)`,
        }
      : activeColor
      ? {
          boxShadow: `0 0 0 1px #FFFFFF, 0 0 0 2px ${activeColor}`,
        }
      : {}),
    ...customStyle,
  };

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={avatarStyle}
      className={`relative ${sizeClass} rounded-full shrink-0 cursor-pointer select-none transition-transform duration-150 ${
        isHovered ? 'scale-125 z-25' : isTarget ? 'z-20' : 'z-10'
      } ${activeColor ? '' : effectiveRing}`}
    >
      {!imgError ? (
        <img
          src={`/players/${playerId}.png`}
          alt={name}
          onError={(e) => {
            e.currentTarget.onerror = null;
            setImgError(true);
          }}
          className="w-full h-full rounded-full object-cover"
        />
      ) : (
        <div
          className="w-full h-full rounded-full flex items-center justify-center font-bold text-white text-[8px] select-none"
          style={{ backgroundColor: activeColor || '#64748B' }}
          title={name}
        >
          {name
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase()}
        </div>
      )}
    </div>
  );
};

export default PlayerNodeAvatar;
