import React from 'react';

interface LoadingSpinnerProps {
  size?: string;
  color?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = '50px', 
  color = '#f7cac9' 
}) => {
  return (
    <div 
      className="loading-spinner-container" 
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        width: '100%',
        backgroundColor: 'transparent'
      }}
    >
      <div 
        className="loading-spinner"
        style={{
          width: size,
          height: size,
          border: `5px solid rgba(255, 255, 255, 0.3)`,
          borderRadius: '50%',
          borderTop: `5px solid ${color}`,
          animation: 'spin 1s linear infinite'
        }}
      />
    </div>
  );
};

export default LoadingSpinner;
