
import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';

const SignIn = ({ onToggle }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Error during sign-in:", error);
      setError(error.message);
    }
  };

  return (
    <div className="auth-form">
      <h2 className="text-xl font-bold mb-4">Sign In</h2>
      <form onSubmit={handleSignIn}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="input-field mb-2"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          className="input-field mb-4"
        />
        {error && <p className="error-message mb-4">{error}</p>}
        <button type="submit" className="button button-primary w-full mb-2">
          Sign In
        </button>
        <button type="button" onClick={onToggle} className="button button-secondary w-full">
          Create a new account
        </button>
      </form>
    </div>
  );
};

export default SignIn;
