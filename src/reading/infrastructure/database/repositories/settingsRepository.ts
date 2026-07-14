import { getDatabase } from '../database';

export type ReaderSettings = {
  fontSize: number;
  lineHeight: number;
  marginSize: number;
  theme: 'light' | 'dark' | 'system';
  fontFamily: 'serif' | 'sans-serif';
  tapLookupEnabled: boolean;
};

export const settingsRepository = {
  async get(): Promise<ReaderSettings> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>('SELECT * FROM reading_settings WHERE id = 1');
    return {
      fontSize: row?.font_size ?? 18,
      lineHeight: row?.line_height ?? 1.65,
      marginSize: row?.margin_size ?? 20,
      theme: row?.theme ?? 'system',
      fontFamily: row?.font_family ?? 'serif',
      tapLookupEnabled: row?.tap_lookup_enabled !== 0,
    };
  },
  async save(settings: ReaderSettings): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE reading_settings SET font_size = ?, line_height = ?, margin_size = ?,
       theme = ?, font_family = ?, tap_lookup_enabled = ? WHERE id = 1`,
      [settings.fontSize, settings.lineHeight, settings.marginSize, settings.theme,
        settings.fontFamily, settings.tapLookupEnabled ? 1 : 0],
    );
  },
};
