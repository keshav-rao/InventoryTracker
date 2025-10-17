// Example of how to modify your existing src/App.js
import React from 'react';
import './InventoryTracker.css';
import InventoryTracker from './InventoryTracker.jsx'; // Import the new component
// import './App.css'; // Keep existing imports if needed

function App() {
  return (
    <div className="App">
      <InventoryTracker /> 
    </div>
  );
}

export default App;

