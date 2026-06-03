import React from 'react';
import { PlayerProfile } from '../services/api';

interface PlayerHeaderProps {
  profile: PlayerProfile;
  mainPosition?: string;
}

const calculateAge = (dobString?: string) => {
  if (!dobString) return null;
  const birthDate = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const getCountryCode = (country?: string) => {
  if (!country) return 'xx';
  const map: Record<string, string> = {
    'peru': 'pe',
    'argentina': 'ar',
    'uruguay': 'uy',
    'brazil': 'br',
    'colombia': 'co',
    'chile': 'cl',
    'ecuador': 'ec',
    'paraguay': 'py',
    'venezuela': 've',
    'bolivia': 'bo',
    'spain': 'es',
    'mexico': 'mx',
    'united states': 'us'
  };
  return map[country.toLowerCase()] || 'xx';
};

const PlayerHeader: React.FC<PlayerHeaderProps> = ({ profile, mainPosition }) => {
  const parts = profile.name.trim().split(' ');
  const lastName = parts.length > 1 ? parts.pop() : profile.name;
  const firstName = parts.length > 0 ? parts.join(' ') : '';

  const age = calculateAge(profile.date_of_birth);
  const countryCode = getCountryCode(profile.nationality);

  const footLower = profile.preferred_foot?.toLowerCase() || '';
  const isLeftFoot = footLower.includes('left') || footLower === 'both';
  const isRightFoot = footLower.includes('right') || footLower === 'both';

  return (
    <div className="bg-white border border-border p-6 rounded-lg shadow-sm flex flex-col lg:flex-row lg:items-stretch justify-between gap-8">
      
      {/* Left Column: Player Info */}
      <div className="flex flex-col flex-1 justify-between h-full py-2 w-full">
        
        <div>
          {/* Name */}
          <div className="flex flex-col">
            {firstName && <span className="text-xl text-gray-500 font-medium">{firstName}</span>}
            <span className="text-5xl font-black text-slate-800 uppercase leading-none mt-1">
              {lastName}
            </span>
          </div>

          {/* Club Row */}
          <div className="flex items-center gap-3 text-sm font-semibold text-gray-700 uppercase tracking-wide flex-wrap mt-6">
            {countryCode !== 'xx' ? (
              <img src={`https://flagcdn.com/w40/${countryCode}.png`} alt={profile.nationality} className="w-6 h-auto shadow-sm" />
            ) : (
              <span>{profile.nationality || 'Unknown'}</span>
            )}
            <span className="text-gray-400">•</span>
            {profile.team && (
              <>
                <span>{profile.team.name}</span>
                {profile.team.logo_url && (
                  <img src={profile.team.logo_url} alt={profile.team.name} className="h-6 object-contain" />
                )}
              </>
            )}
            <img src="/liga1-logo.png" alt="Liga 1" className="h-6 object-contain ml-2" />
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="flex flex-wrap items-center gap-8 pt-8">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Position</span>
            <span className="text-lg font-bold text-slate-800">{mainPosition || profile.position || profile.position_group || 'Unknown'}</span>
          </div>
          
          {age !== null && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Age</span>
              <span className="text-lg font-bold text-slate-800">{age}</span>
            </div>
          )}
          
          {profile.height != null && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Height</span>
              <span className="text-lg font-bold text-slate-800">{profile.height} cm</span>
            </div>
          )}
          
          {profile.preferred_foot && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Foot</span>
              <div className="flex items-center h-[28px]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="4" y="5" width="6" height="14" rx="3" fill={isLeftFoot ? '#1e3a8a' : '#cbd5e1'} />
                  <rect x="14" y="5" width="6" height="14" rx="3" fill={isRightFoot ? '#1e3a8a' : '#cbd5e1'} />
                </svg>
              </div>
            </div>
          )}
          
          {profile.shirt_number != null && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Shirt No.</span>
              <span className="text-lg font-bold text-slate-800">#{profile.shirt_number}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Action Photo */}
      <div className="relative w-full lg:w-[450px] shrink-0 h-64 lg:h-auto min-h-[250px] rounded-xl overflow-hidden shadow-sm border border-gray-200 bg-slate-200">
        <img 
          src={`/player_images/${profile.player_id}.jpg`} 
          alt={profile.name}
          className="absolute inset-0 w-full h-full object-cover grayscale brightness-110 contrast-125"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        {/* The Tint Overlay */}
        <div className="absolute inset-0 bg-[#1e3a8a] mix-blend-multiply opacity-40 pointer-events-none" />
      </div>

    </div>
  );
};

export default PlayerHeader;
