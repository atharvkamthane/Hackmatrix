import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/react';
import { App } from './App';
import './style.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

root.render(
  <React.StrictMode>
    {publishableKey ? (
      <ClerkProvider publishableKey={publishableKey}>
        <App />
      </ClerkProvider>
    ) : (
      <main className="min-h-screen grid place-items-center bg-slate-50 p-6">
        <section className="max-w-lg rounded-lg border border-amber-300 bg-white p-6 text-sm text-slate-700 shadow-sm">
          Set <code>VITE_CLERK_PUBLISHABLE_KEY</code> to enable administrator sign-in.
        </section>
      </main>
    )}
  </React.StrictMode>,
);
