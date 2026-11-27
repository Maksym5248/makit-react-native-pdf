import React from 'react';

export function FilePicker({ onOpen }: { onOpen: (uri: string) => void }) {
  return (
    <input
      aria-label="Вибрати локальний PDF"
      type="file"
      accept="application/pdf"
      onChange={event => {
        const file = event.target.files?.[0];
        if (file) onOpen(URL.createObjectURL(file));
        event.target.value = '';
      }}
    />
  );
}
