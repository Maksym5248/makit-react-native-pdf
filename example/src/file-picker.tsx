import React, { useState } from 'react';

import { TextInput, View } from 'react-native';

import { Button } from './button';

export function FilePicker({ onOpen }: { onOpen: (uri: string) => void }) {
  const [uri, setUri] = useState('');
  return (
    <View>
      <TextInput
        accessibilityLabel="Local PDF path"
        placeholder="file:///… або content://…"
        value={uri}
        onChangeText={setUri}
        autoCapitalize="none"
      />
      <Button title="Відкрити локальний URI" onPress={() => onOpen(uri)} />
    </View>
  );
}
