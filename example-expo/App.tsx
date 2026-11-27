import React from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { Asset } from 'expo-asset';
import { ReadingRoom } from '../example/src/reading-room';

async function loadGuide() {
    const guide = Asset.fromModule(require('../example/fixtures/night-sky.pdf'));
    await guide.downloadAsync();
    if (!guide.localUri) throw new Error('Could not open The Night Sky.');
    return { uri: guide.localUri, name: 'The Night Sky' };
}

async function chooseFile() {
    const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
    });
    if (!result.canceled) {
        const file = result.assets[0];
        return { uri: file.uri, name: file.name };
    }
}

export default function App() {
    return <ReadingRoom loadGuide={loadGuide} chooseFile={chooseFile} />;
}
