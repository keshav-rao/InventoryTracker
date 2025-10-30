import React, { useMemo } from 'react';

const TrendsButton = ({ onClick, disabled }) => {
  const buttonStyle = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    backgroundColor: disabled ? '#f5f5f5' : '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.7 : 1
  }), [disabled]);

  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      style={buttonStyle}
    >
      <span role="img" aria-label="trends">📈</span>
      Trends & Reports
    </button>
  );
};

export default TrendsButton;