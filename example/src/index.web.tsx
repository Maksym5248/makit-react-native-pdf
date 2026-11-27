import React from 'react';

import { createRoot } from 'react-dom/client';

import { App } from './app';

const root = document.getElementById('root');
if (!root) throw new Error('Missing example root');
createRoot(root).render(<App />);
