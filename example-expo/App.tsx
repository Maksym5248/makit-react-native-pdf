import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { PdfReader, type IPdfReaderRef } from '@makit/react-native-pdf';
import { fixtureBase64 } from '../example/src/fixture';

export default function App() {
  const reader = useRef<IPdfReaderRef>(null);
  const [uri, setUri] = useState('');
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState(
    'Choose a local PDF or open the sample.',
  );
  const open = (next: string) => {
    setRevision(value => value + 1);
    setPage(1);
    setTotal(0);
    setStatus('Opening…');
    setUri(next);
  };
  const pick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (!result.canceled) open(result.assets[0].uri);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };
  const sample = () => {
    try {
      const file = new File(Paths.document, 'pdf-reader-sample.pdf');
      if (!file.exists) {
        file.create();
        file.write(fixtureBase64, { encoding: 'base64' });
      }
      open(file.uri);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>MAKIT · EXPO DEVELOPMENT BUILD</Text>
          <Text style={styles.title}>A little space to read.</Text>
          <Text style={styles.subtitle}>
            Local PDF. Native rendering. No upload.
          </Text>
        </View>
        <View style={styles.toolbar}>
          <Pressable
            accessibilityRole="button"
            style={styles.button}
            onPress={pick}
          >
            <Text style={styles.buttonText}>Choose PDF</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={styles.secondary}
            onPress={sample}
          >
            <Text>Open sample</Text>
          </Pressable>
        </View>
        {uri ? (
          <PdfReader
            key={`${uri}:${revision}`}
            ref={reader}
            sourceUri={uri}
            style={styles.reader}
            onLoadComplete={count => {
              setTotal(count);
              setStatus('Ready • stored on your device');
            }}
            onPageChanged={(current, count) => {
              setPage(current);
              setTotal(count);
            }}
            onError={error => setStatus(error.message)}
          />
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Your document stays with you.</Text>
            <Text style={styles.subtitle}>
              Open the synthetic sample to try the native reader.
            </Text>
          </View>
        )}
        <View style={styles.toolbar}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: page <= 1 }}
            disabled={page <= 1}
            style={styles.secondary}
            onPress={() => reader.current?.setPage(page - 1)}
          >
            <Text>Previous</Text>
          </Pressable>
          <Text>
            {page} / {total}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: page >= total }}
            disabled={page >= total}
            style={styles.secondary}
            onPress={() => reader.current?.setPage(page + 1)}
          >
            <Text>Next</Text>
          </Pressable>
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.status}>
          {status}
        </Text>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f4f0' },
  header: { padding: 24, gap: 8 },
  eyebrow: {
    color: '#516b50',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: { fontSize: 30, fontWeight: '600', color: '#202d24' },
  subtitle: { color: '#5d685f', lineHeight: 22 },
  toolbar: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: { backgroundColor: '#294b39', borderRadius: 12, padding: 14 },
  buttonText: { color: '#fff', fontWeight: '600' },
  secondary: {
    backgroundColor: '#e6e9e2',
    borderRadius: 12,
    padding: 14,
    minHeight: 44,
  },
  reader: { flex: 1 },
  empty: { flex: 1, padding: 32, justifyContent: 'center', gap: 12 },
  emptyTitle: { fontSize: 24, color: '#294b39' },
  status: { padding: 12, color: '#5d685f' },
});
