import React from 'react';
import { PredictionDashboard } from '../components/PredictionDashboard';

const Predictor: React.FC = () => {
  return (
    <div className="flex flex-col items-center w-full">
      <PredictionDashboard />
    </div>
  );
};

export default Predictor;
