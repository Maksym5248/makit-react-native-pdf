import { fixtureBase64 } from './fixture';
import { qaFixtures } from './qa-fixtures';

export const openFixture = async (
  name: 'text' | keyof typeof qaFixtures = 'text',
): Promise<string> => {
  const bytes = Uint8Array.from(
    atob(name === 'text' ? fixtureBase64 : qaFixtures[name]),
    char => char.charCodeAt(0),
  );
  return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
};
export const releaseFile = (uri: string): void => URL.revokeObjectURL(uri);
export const saveQaReport = async (
  report: string,
  name = 'pdf-qa-report.json',
): Promise<void> => {
  console.info(name, report);
};
