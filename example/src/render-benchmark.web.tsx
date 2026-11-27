import React from 'react';

import { Text, View } from 'react-native';

import { Button } from './button';

export function RenderBenchmark({
  onClose,
}: {
  uri: string;
  onClose: () => void;
}) {
  return (
    <View>
      <Text>The react-native-pdf baseline is available in native builds.</Text>
      <Button title="Close render benchmark" onPress={onClose} />
    </View>
  );
}
