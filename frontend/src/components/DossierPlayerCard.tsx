import React from 'react';
import { PlayerProfile } from '../services/api';

interface DossierPlayerCardProps {
  profile: PlayerProfile;
  mainPosition?: string;
  themeColor?: string;
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

const DossierPlayerCard: React.FC<DossierPlayerCardProps> = ({ profile, mainPosition, themeColor }) => {
  const parts = profile.name.trim().split(' ');
  const lastName = parts.length > 1 ? parts.pop() : profile.name;
  const firstName = parts.length > 0 ? parts.join(' ') : '';

  const age = calculateAge(profile.date_of_birth);
  const countryCode = getCountryCode(profile.nationality);

  const footLower = profile.preferred_foot?.toLowerCase() || '';
  const isLeftFoot = footLower.includes('left') || footLower === 'both';
  const isRightFoot = footLower.includes('right') || footLower === 'both';

  return (
    <div className="bg-white rounded-lg flex flex-col h-full w-full">
      {/* Top: Action Photo */}
      <div className="relative w-full aspect-[4/5] rounded-t-lg overflow-hidden shrink-0 bg-slate-100">
        <img 
          src={`/player_images/${profile.player_id}.jpg`} 
          alt={profile.name}
          className="absolute inset-0 w-full h-full object-cover grayscale"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div 
          className="absolute inset-0 mix-blend-multiply opacity-50"
          style={{ backgroundColor: themeColor || '#1e3a8a' }}
        />
      </div>

      {/* Bottom: Info & Metadata */}
      <div className="p-8 flex flex-col gap-8 grow">
        {/* Name */}
        <div className="flex flex-col text-center">
          {firstName && <span className="text-3xl text-gray-500 font-medium tracking-wide">{firstName}</span>}
          <span className="text-6xl tracking-tighter font-black text-slate-800 uppercase leading-none mt-2">
            {lastName}
          </span>
        </div>

        {/* Logos */}
        <div className="flex justify-center items-center gap-6">
          {countryCode !== 'xx' ? (
            <img src={`https://flagcdn.com/w80/${countryCode}.png`} alt={profile.nationality} className="h-12 w-auto shadow-sm" />
          ) : (
            <span className="text-2xl font-semibold">{profile.nationality || 'Unknown'}</span>
          )}
          <span className="text-gray-300 text-3xl">|</span>
          {profile.team && profile.team.logo_url && (
            <img src={profile.team.logo_url} alt={profile.team.name} className="h-16 w-auto object-contain" />
          )}
          <span className="text-gray-300 text-3xl">|</span>
          <img src="/liga1-logo.png" alt="Liga 1" className="h-16 w-auto object-contain" />
        </div>

        {/* Metadata List */}
        <div className="flex flex-col gap-4 mt-auto pt-6 border-t-4 border-gray-100">
          <div className="flex justify-between items-center border-b border-gray-100 pb-2">
            <span className="text-2xl text-gray-400 uppercase tracking-widest font-bold">Position</span>
            <span className="text-3xl font-black text-navy">{mainPosition || profile.position || profile.position_group || 'Unknown'}</span>
          </div>
          
          {age !== null && (
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <span className="text-2xl text-gray-400 uppercase tracking-widest font-bold">Age</span>
              <span className="text-3xl font-black text-slate-700">{age} yrs</span>
            </div>
          )}
          
          {profile.height != null && (
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <span className="text-2xl text-gray-400 uppercase tracking-widest font-bold">Height</span>
              <span className="text-3xl font-black text-slate-700">{profile.height} cm</span>
            </div>
          )}
          
          {profile.preferred_foot && (
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <span className="text-2xl text-gray-400 uppercase tracking-widest font-bold">Foot</span>
              <div className="flex items-center gap-1">
                 <span className="text-3xl font-black text-slate-700 uppercase">{profile.preferred_foot}</span>
              </div>
            </div>
          )}
          
          {profile.shirt_number != null && (
            <div className="flex justify-between items-center pb-2">
              <span className="text-2xl text-gray-400 uppercase tracking-widest font-bold">Shirt No.</span>
              <span className="text-3xl font-black text-slate-700">#{profile.shirt_number}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DossierPlayerCard;
