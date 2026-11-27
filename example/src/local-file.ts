import { Dirs, FileSystem } from 'react-native-file-access';

import { fixtureBase64 } from './fixture';
import { qaFixtures } from './qa-fixtures';

export const openFixture = async (
  name: 'text' | keyof typeof qaFixtures = 'text',
): Promise<string> => {
  // The OS can evict cache files while a document is still open (e.g. during APK installation).
  const path = `${Dirs.DocumentDir}/pdf-reader-example-v2-${name}.pdf`;
  if (!(await FileSystem.exists(path)))
    await FileSystem.writeFile(
      path,
      name === 'text' ? fixtureBase64 : qaFixtures[name],
      'base64',
    );
  return path;
};
export const saveQaReport = async (
  report: string,
  name = 'pdf-qa-report.json',
): Promise<void> => {
  await FileSystem.writeFile(`${Dirs.DocumentDir}/${name}`, report, 'utf8');
};
export const releaseFile = (uri: string): void => {
  void uri;
};
