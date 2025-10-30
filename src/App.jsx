
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import InventoryTracker from './InventoryTracker';
import SignIn from './SignIn';
import SignUp from './SignUp'; // Import SignUp
import SignOut from './SignOut';
import './InventoryTracker.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSigningUp, setIsSigningUp] = useState(false); // State to toggle forms

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="loading-spinner-container">
        <div className="spinner"></div>
        <p className="ml-4 text-lg text-indigo-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="flex justify-between items-center p-4 bg-gray-100">
        <h1 className="text-2xl font-bold">Inventory Tracker</h1>
        <div>
          {user && <SignOut />}
        </div>
      </header>
      <main className="p-4">
        {user ? (
          <InventoryTracker user={user} />
        ) : (
          <div className="auth-container">
            {isSigningUp ? (
              <SignUp onToggle={() => setIsSigningUp(false)} />
            ) : (
              <SignIn onToggle={() => setIsSigningUp(true)} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
