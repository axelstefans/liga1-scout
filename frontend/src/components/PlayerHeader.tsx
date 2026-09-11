import React from 'react';
import { PlayerProfile } from '../services/api';

interface PlayerHeaderProps {
  profile: PlayerProfile;
  mainPosition?: string;
  themeColor?: string;
}

const calculateAge = (dobString?: string | null) => {
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

const getCountryCode = (country?: string | null) => {
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

const PlayerHeader: React.FC<PlayerHeaderProps> = ({ profile, mainPosition, themeColor }) => {
  const parts = profile.name.trim().split(' ');
  const lastName = parts.length > 1 ? parts.pop() : profile.name;
  const firstName = parts.length > 0 ? parts.join(' ') : '';

  const age = calculateAge(profile.date_of_birth);
  const countryCode = getCountryCode(profile.nationality);

  const footLower = profile.preferred_foot?.toLowerCase() || '';
  const isLeftFoot = footLower.includes('left') || footLower === 'both';
  const isRightFoot = footLower.includes('right') || footLower === 'both';

  return (
    <div className="bg-white border border-border p-8 rounded-lg shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
      
      {/* Left Column: Player Info */}
      <div className="lg:col-span-4 flex flex-col justify-center h-full gap-6 w-full">
        
        {/* Name */}
        <div className="flex flex-col">
          {firstName && <span className="text-2xl text-gray-500 font-medium">{firstName}</span>}
          <span className="text-7xl tracking-tight font-black text-slate-800 uppercase leading-none mt-1">
            {lastName}
          </span>
        </div>

        {/* Club Row */}
        <div className="flex items-center gap-3 text-sm font-semibold text-gray-700 uppercase tracking-wide flex-wrap">
          {countryCode !== 'xx' ? (
            <img src={`https://flagcdn.com/w40/${countryCode}.png`} alt={profile.nationality || ''} className="w-6 h-auto shadow-sm" />
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

      {/* Center Column: Metadata */}
      <div className="lg:col-span-3 flex flex-col justify-center h-full gap-4 w-full">
        <div className="flex justify-between items-center border-b border-gray-100 pb-1">
          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Position</span>
          <span className="text-lg font-black text-navy">{mainPosition || profile.position || profile.position_group || 'Unknown'}</span>
        </div>
        
        {age !== null && (
          <div className="flex justify-between items-center border-b border-gray-100 pb-1">
            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Age</span>
            <span className="text-lg font-black text-navy">{age}</span>
          </div>
        )}
        
        {profile.height != null && (
          <div className="flex justify-between items-center border-b border-gray-100 pb-1">
            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Height</span>
            <span className="text-lg font-black text-navy">{profile.height} cm</span>
          </div>
        )}
        
        {profile.preferred_foot && (
          <div className="flex justify-between items-center border-b border-gray-100 pb-1">
            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Foot</span>
            <div className="flex items-center h-[20px]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.5 3C7.5 3 6 4.5 5.5 7C5 9.5 4 12 4 15.5C4 18.5 5.5 21 7.5 21C9.5 21 11 18.5 11 15.5C11 12 10 9.5 9.5 7C9 4.5 10.5 3 9.5 3Z" fill={isLeftFoot ? '#1e3a8a' : '#cbd5e1'} />
                <path d="M14.5 3C16.5 3 18 4.5 18.5 7C19 9.5 20 12 20 15.5C20 18.5 18.5 21 16.5 21C14.5 21 13 18.5 13 15.5C13 12 14 9.5 14.5 7C15 4.5 13.5 3 14.5 3Z" fill={isRightFoot ? '#1e3a8a' : '#cbd5e1'} />
              </svg>
            </div>
          </div>
        )}
        
        {profile.shirt_number != null && (
          <div className="flex justify-between items-center border-b border-gray-100 pb-1">
            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Shirt No.</span>
            <span className="text-lg font-black text-navy">#{profile.shirt_number}</span>
          </div>
        )}
      </div>

      {/* Right Column: Action Photo */}
      <div className="lg:col-span-5 relative w-full h-64 rounded-xl overflow-hidden shadow-sm border border-gray-200 shrink-0 bg-slate-100">
        <img 
          src={`/player_images/${profile.player_id}.jpg`} 
          alt={profile.name}
          className="absolute inset-0 w-full h-full object-cover grayscale"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div 
          className="absolute inset-0 mix-blend-multiply opacity-60 transition-colors duration-500"
          style={{ backgroundColor: themeColor || '#1e3a8a' }}
        />
      </div>

    </div>
  );
};

export default PlayerHeader;
