'use client';

import { Toaster } from 'react-hot-toast';

export function ToasterProvider() {
  return (
    <Toaster
      position="top-right"
      gutter={8}
      containerStyle={{ top: 64 }}
      toastOptions={{
        duration: 4000,
        style: {
          background: '#ffffff',
          color: '#0f172a',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          fontSize: '13.5px',
          fontWeight: 500,
          padding: '12px 16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
          maxWidth: '360px',
          lineHeight: '1.5',
        },
        success: {
          iconTheme: { primary: '#10b981', secondary: '#fff' },
          style: { borderLeft: '3px solid #10b981' },
        },
        error: {
          iconTheme: { primary: '#ef4444', secondary: '#fff' },
          style: { borderLeft: '3px solid #ef4444' },
          duration: 5000,
        },
        loading: {
          iconTheme: { primary: '#6366f1', secondary: '#fff' },
          style: { borderLeft: '3px solid #6366f1' },
        },
      }}
    />
  );
}
