import React from 'react';
import type { WelcomeScreenProps } from '../types';
import dindinNp from '../../../assets/dindin_np.PNG';

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ userName = 'Guest' }) => {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <img
          src={dindinNp}
          alt="DINDIN AI"
          className="w-32 h-32 mx-auto mb-3 rounded-full"
        />
        <h1 className="text-2xl font-bold text-primary mb-1">Welcome</h1>
        <h2
          className="text-2xl font-bold mb-1 bg-gradient-to-r from-[rgb(186,12,47)] to-[rgb(212,175,55)] text-transparent bg-clip-text"
        >
          {userName}
        </h2>
        <h3 className="text-lg text-primary">How can I help you today?</h3>
      </div>
    </div>
  );
};

export default WelcomeScreen;