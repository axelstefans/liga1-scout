import React from 'react';
import { PlayerProfile } from '../services/api';

interface PlayerHeaderProps {
  profile: PlayerProfile;
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

const PlayerHeader: React.FC<PlayerHeaderProps> = ({ profile }) => {
  const parts = profile.name.trim().split(' ');
  const lastName = parts.length > 1 ? parts.pop() : profile.name;
  const firstName = parts.length > 0 ? parts.join(' ') : '';

  const age = calculateAge(profile.date_of_birth);

  return (
    <div className="bg-white border border-border p-6 rounded-lg shadow-sm flex flex-col lg:flex-row items-center lg:items-start justify-between gap-8">
      
      {/* Left Column: Player Info */}
      <div className="flex flex-col flex-1 space-y-6">
        
        {/* Name */}
        <div className="flex flex-col">
          {firstName && <span className="text-xl text-gray-500 font-medium">{firstName}</span>}
          <span className="text-5xl font-black text-slate-800 uppercase leading-none mt-1">
            {lastName}
          </span>
        </div>

        {/* Club Row */}
        <div className="flex items-center gap-3 text-sm font-semibold text-gray-700 uppercase tracking-wide flex-wrap">
          <span>{profile.nationality || 'Unknown'}</span>
          <span className="text-gray-400">•</span>
          {profile.team && (
            <>
              <span>{profile.team.name}</span>
              {profile.team.logo_url && (
                <img src={profile.team.logo_url} alt={profile.team.name} className="h-6 object-contain" />
              )}
            </>
          )}
          <img src="/liga1-logo.png" alt="Liga 1" className="h-6 object-contain" />
        </div>

        {/* Metadata Grid */}
        <div className="flex flex-wrap gap-6 pt-4 border-t border-gray-100">
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Position</span>
            <span className="text-base font-bold text-slate-800">{profile.position || profile.position_group || 'Unknown'}</span>
          </div>
          
          {age !== null && (
            <div className="flex flex-col">
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Age</span>
              <span className="text-base font-bold text-slate-800">{age}</span>
            </div>
          )}
          
          {profile.height != null && (
            <div className="flex flex-col">
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Height</span>
              <span className="text-base font-bold text-slate-800">{profile.height} cm</span>
            </div>
          )}
          
          {profile.preferred_foot && (
            <div className="flex flex-col">
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Foot</span>
              <span className="text-base font-bold text-slate-800 capitalize">{profile.preferred_foot}</span>
            </div>
          )}
          
          {profile.shirt_number != null && (
            <div className="flex flex-col">
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Shirt No.</span>
              <span className="text-base font-bold text-slate-800">#{profile.shirt_number}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Action Photo */}
      <div className="relative w-full lg:max-w-md xl:max-w-lg h-64 rounded-xl overflow-hidden shadow-sm border border-gray-200 shrink-0 bg-slate-200">
        <img 
          src={`/player_images/${profile.player_id}.jpg`} 
          alt={profile.name}
          className="w-full h-full object-cover grayscale"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        {/* The Tint Overlay */}
        <div className="absolute inset-0 bg-[#1e3a8a] mix-blend-multiply opacity-80 pointer-events-none" />
      </div>

    </div>
  );
};

export default PlayerHeader;
