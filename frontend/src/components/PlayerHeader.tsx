import React from 'react';
import { PlayerProfile } from '../services/api';
import { MapPin, User2, Shirt } from 'lucide-react';

interface PlayerHeaderProps {
  profile: PlayerProfile;
}

const PlayerHeader: React.FC<PlayerHeaderProps> = ({ profile }) => {
  return (
    <div className="bg-white border border-border p-6 rounded-lg shadow-sm flex flex-col md:flex-row items-center md:items-start justify-between">
      <div className="flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-6">
        
        {/* Number Badge (Fallback if no image) */}
        <div className="w-24 h-24 rounded-full bg-cream border-2 border-border flex items-center justify-center flex-shrink-0">
          <span className="text-4xl font-display text-navy">
            {profile.shirt_number || '-'}
          </span>
        </div>

        <div className="text-center md:text-left">
          <h2 className="text-5xl font-display text-navy mb-1 uppercase">{profile.name}</h2>
          
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-gray-600 font-medium">
            <span className="flex items-center">
              <User2 className="w-4 h-4 mr-1 text-navy-blue" />
              {profile.position_group || profile.position || 'Unknown Position'}
            </span>
            <span className="flex items-center">
              <MapPin className="w-4 h-4 mr-1 text-navy-blue" />
              {profile.nationality || 'Unknown'}
            </span>
            {profile.date_of_birth && (
              <span className="flex items-center text-gray-500">
                DOB: {profile.date_of_birth}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 md:mt-0 flex flex-col items-center md:items-end">
        {profile.team && (
          <div className="flex items-center space-x-3 bg-cream px-4 py-2 rounded-lg border border-border">
            {profile.team.logo_url && (
              <img src={profile.team.logo_url} alt={profile.team.name} className="w-10 h-10 object-contain" />
            )}
            <span className="font-display tracking-wide text-lg text-navy">{profile.team.name}</span>
          </div>
        )}
        {profile.market_value_str && (
          <div className="mt-4 text-sm font-semibold text-navy">
            Est. Value: <span className="text-navy-blue text-lg ml-1">{profile.market_value_str}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerHeader;
