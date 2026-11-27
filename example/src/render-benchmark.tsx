import React, { useEffect, useRef, useState } from 'react';

import {
  PdfReader,
  type IPdfReaderRef,
} from '@makit-kit/react-native-pdf';
import { Text, View } from 'react-native';
import LegacyPdf, { type PdfRef } from 'react-native-pdf';

import { Button } from './button';
import { saveQaReport } from './local-file';

interface Sample {
  backend: 'package' | 'react-native-pdf-7.0.4';
  pages: number;
  loadCallbackMs: number;
  navigationCallbackMs: number[];
  jsFrameP95Ms: number;
  jsFrameMaxMs: number;
}

function Trial({
  uri,
  legacy,
  measure = true,
  onComplete,
  onError,
}: {
  uri: string;
  legacy: boolean;
  measure?: boolean;
  onComplete?: (sample: Sample) => void;
  onError: (error: Error) => void;
}) {
  const reader = useRef<IPdfReaderRef>(null);
  const oldReader = useRef<PdfRef>(null);
  const started = useRef(performance.now());
  const loaded = useRef(false);
  const page = useRef(0);
  const frames = useRef<number[]>([]);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    if (!measure)
      return () => {
        active.current = false;
      };
    let previous = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      frames.current.push(now - previous);
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      active.current = false;
      cancelAnimationFrame(frame);
    };
  }, [measure]);
  const onLoad = async (pages: number) => {
    if (loaded.current || !measure) return;
    loaded.current = true;
    const loadCallbackMs = performance.now() - started.current;
    const navigationCallbackMs: number[] = [];
    try {
      // Let initial tiles finish before navigating; this is not a first-paint metric.
      await new Promise(resolve => setTimeout(resolve, 1000));
      for (const target of [Math.ceil(pages / 2), pages, 1, pages, 1]) {
        if (!active.current) return;
        const begin = performance.now();
        if (legacy) oldReader.current?.setPage(target);
        else reader.current?.setPage(target);
        while (page.current !== target) {
          if (!active.current) return;
          if (performance.now() - begin > 10000)
            throw new Error('Navigation timed out');
          await new Promise(resolve => setTimeout(resolve, 16));
        }
        navigationCallbackMs.push(performance.now() - begin);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      const sorted = [...frames.current].sort((a, b) => a - b);
      onComplete?.({
        backend: legacy ? 'react-native-pdf-7.0.4' : 'package',
        pages,
        loadCallbackMs,
        navigationCallbackMs,
        jsFrameP95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
        jsFrameMaxMs: sorted[sorted.length - 1] ?? 0,
      });
    } catch (error) {
      if (active.current)
        onError(error instanceof Error ? error : new Error(String(error)));
    }
  };
  return legacy ? (
    <LegacyPdf
      ref={oldReader}
      source={{ uri: uri.startsWith('/') ? `file://${uri}` : uri }}
      fitPolicy={0}
      spacing={10}
      minScale={0.6}
      maxScale={3}
      onLoadComplete={onLoad}
      onPageChanged={value => {
        page.current = value;
      }}
      onError={error =>
        onError(error instanceof Error ? error : new Error(String(error)))
      }
      style={{ flex: 1 }}
    />
  ) : (
    <PdfReader
      ref={reader}
      sourceUri={uri}
      onLoadComplete={onLoad}
      onPageChanged={value => {
        page.current = value;
      }}
      onError={error =>
        onError(error instanceof Error ? error : new Error(String(error)))
      }
      style={{ flex: 1 }}
    />
  );
}

export function RenderBenchmark({
  uri,
  onClose,
}: {
  uri: string;
  onClose: () => void;
}) {
  const [trial, setTrial] = useState(0);
  const [status, setStatus] = useState('Render benchmark 1/6');
  const [failed, setFailed] = useState(false);
  const [manual, setManual] = useState<'package' | 'legacy'>();
  const samples = useRef<Sample[]>([]);
  return (
    <View style={{ flex: 1 }}>
      <Text>{status}</Text>
      <Button title="Close render benchmark" onPress={onClose} />
      {trial >= 6 && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <Button
            title="Scroll package"
            onPress={() => {
              setManual('package');
              setStatus('Scroll package');
            }}
          />
          <Button
            title="Scroll baseline"
            onPress={() => {
              setManual('legacy');
              setStatus('Scroll baseline');
            }}
          />
        </View>
      )}
      {manual && (
        <Trial
          key={manual}
          uri={uri}
          legacy={manual === 'legacy'}
          measure={false}
          onError={error => setStatus(error.message)}
        />
      )}
      {!failed && trial < 6 && (
        <Trial
          key={trial}
          uri={uri}
          legacy={trial % 2 === 1}
          onError={error => {
            setFailed(true);
            setStatus(error.message);
          }}
          onComplete={sample => {
            samples.current.push(sample);
            const next = trial + 1;
            setTrial(next);
            if (next < 6) setStatus(`Render benchmark ${next + 1}/6`);
            else
              void saveQaReport(
                JSON.stringify(
                  {
                    mode: __DEV__ ? 'debug' : 'release',
                    samples: samples.current,
                  },
                  null,
                  2,
                ),
                'pdf-render-benchmark.json',
              )
                .then(() => setStatus('Render benchmark complete'))
                .catch(error => setStatus(String(error)));
          }}
        />
      )}
    </View>
  );
}
