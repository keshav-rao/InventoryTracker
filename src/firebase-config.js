import { initializeApp } from 'firebase/app';
import { getApps, getApp } from 'firebase/app';
import { localfirebaseconfig } from './localfirebaseconfig';

// Initialize Firebase only if it hasn't been initialized yet
const app = getApps().length === 0 ? initializeApp(localfirebaseconfig) : getApp();

export default app;