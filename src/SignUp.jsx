
import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';

const SignUp = ({ onToggle }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Error during sign-up:", error);
      setError(error.message);
    }
  };

  return (
    <div className="auth-form">
      <h2 className="text-xl font-bold mb-4">Create Account</h2>
      <form onSubmit={handleSignUp}>
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
          Sign Up
        </button>
        <button type="button" onClick={onToggle} className="button button-secondary w-full">
          Already have an account? Sign In
        </button>
      </form>
    </div>
  );
};

export default SignUp;
