import React from 'react';

import { createRoot } from 'react-dom/client';

import { App } from './app';
import { ReadingRoom, type ReaderFile } from './reading-room';

async function loadGuide() {
  const response = await fetch(
    new URL('../fixtures/night-sky.pdf', import.meta.url),
  );
  if (!response.ok) throw new Error('Could not open The Night Sky.');
  return {
    uri: URL.createObjectURL(await response.blob()),
    name: 'The Night Sky',
  };
}

function chooseFile() {
  return new Promise<ReaderFile | undefined>(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.oncancel = () => resolve(undefined);
    input.onchange = () => {
      const file = input.files?.[0];
      resolve(file && { uri: URL.createObjectURL(file), name: file.name });
    };
    input.click();
  });
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing example root');
const checks = new URLSearchParams(window.location.search).has('checks');
createRoot(root).render(
  checks ? (
    <App />
  ) : (
    <ReadingRoom
      loadGuide={loadGuide}
      chooseFile={chooseFile}
      releaseFile={URL.revokeObjectURL}
    />
  ),
);
