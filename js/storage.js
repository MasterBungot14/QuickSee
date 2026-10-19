/**
 * QuickSee - Storage Layer (Local-First MVP)
 * Handles versioned schema, LocalStorage persistence, export/backup, and restore.
 */

const STORAGE_KEY = 'quicksee_data_v1';
const SETTINGS_KEY = 'quicksee_settings_v1';

const DEFAULT_SETTINGS = {
  milestoneWindowDays: 30, // 7, 30, or 90
  dateFormat: 'YYYY-MM-DD',
  defaultView: 'dashboard',
  defaultCalendarView: 'month' // 'month' or 'agenda'
};

class StorageService {
  constructor() {
    this.listeners = [];
    this.init();
  }

  init() {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const initialData = {
        version: '1.0',
        createdAt: new Date().toISOString(),
        lastBackupAt: null,
        cryptoProjects: [],
        games: []
      };
      this._saveRaw(initialData);
    }
  }

  _getRaw() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { cryptoProjects: [], games: [], version: '1.0' };
    } catch (e) {
      console.error('Failed to parse QuickSee data from localStorage', e);
      return { cryptoProjects: [], games: [], version: '1.0' };
    }
  }

  _saveRaw(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      this._notifyListeners();
    } catch (e) {
      console.error('Failed to save QuickSee data to localStorage', e);
      throw new Error('Local storage quota exceeded or storage disabled.');
    }
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  _notifyListeners() {
    const data = this._getRaw();
    this.listeners.forEach(cb => {
      try { cb(data); } catch (err) { console.error('Listener error:', err); }
    });
  }

  // --- Crypto Projects CRUD ---
  getCryptoProjects() {
    return this._getRaw().cryptoProjects || [];
  }

  getCryptoProject(id) {
    return this.getCryptoProjects().find(p => p.id === id);
  }

  addCryptoProject(project) {
    const data = this._getRaw();
    const now = new Date().toISOString();
    const newRecord = {
      id: project.id || 'cp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      name: (project.name || '').trim(),
      network: (project.network || '').trim(),
      tokenSymbol: (project.tokenSymbol || '').trim(),
      contractAddress: (project.contractAddress || '').trim(),
      type: project.type === 'Whitelist' ? 'Whitelist' : 'Airdrop', // Required selection
      xPostLink: (project.xPostLink || '').trim(),
      dateJoined: project.dateJoined || '',
      releaseDate: project.releaseDate || '', // Expected release / TGE date
      claimDate: project.claimDate || '',
      listingDate: project.listingDate || '',
      dateConfidence: project.dateConfidence === 'Confirmed' ? 'Confirmed' : 'Estimated',
      status: project.status || 'Joined',
      notes: (project.notes || '').trim(),
      createdAt: now,
      updatedAt: now
    };

    data.cryptoProjects.unshift(newRecord);
    this._saveRaw(data);
    return newRecord;
  }

  updateCryptoProject(id, updates) {
    const data = this._getRaw();
    const idx = data.cryptoProjects.findIndex(p => p.id === id);
    if (idx === -1) return null;

    data.cryptoProjects[idx] = {
      ...data.cryptoProjects[idx],
      ...updates,
      id, // Preserve ID
      updatedAt: new Date().toISOString()
    };

    this._saveRaw(data);
    return data.cryptoProjects[idx];
  }

  deleteCryptoProject(id) {
    const data = this._getRaw();
    data.cryptoProjects = data.cryptoProjects.filter(p => p.id !== id);
    this._saveRaw(data);
    return true;
  }

  // --- Games CRUD ---
  getGames() {
    return this._getRaw().games || [];
  }

  getGame(id) {
    return this.getGames().find(g => g.id === id);
  }

  addGame(game) {
    const data = this._getRaw();
    const now = new Date().toISOString();
    const newRecord = {
      id: game.id || 'gm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      name: (game.name || '').trim(),
      officialLink: (game.officialLink || '').trim(),
      network: (game.network || '').trim(),
      tokenSymbol: (game.tokenSymbol || '').trim(),
      tokenPrice: game.tokenPrice !== undefined && game.tokenPrice !== '' ? Number(game.tokenPrice) : null,
      contractAddress: (game.contractAddress || '').trim(),
      dateJoined: game.dateJoined || '',
      gameReleaseDate: game.gameReleaseDate || '',
      tokenReleaseDate: game.tokenReleaseDate || '',
      dateConfidence: game.dateConfidence === 'Confirmed' ? 'Confirmed' : 'Estimated',
      status: game.status || 'Researching',
      notes: (game.notes || '').trim(),
      createdAt: now,
      updatedAt: now
    };

    data.games.unshift(newRecord);
    this._saveRaw(data);
    return newRecord;
  }

  updateGame(id, updates) {
    const data = this._getRaw();
    const idx = data.games.findIndex(g => g.id === id);
    if (idx === -1) return null;

    if (updates.tokenPrice !== undefined && updates.tokenPrice !== '') {
      updates.tokenPrice = Number(updates.tokenPrice);
    }

    data.games[idx] = {
      ...data.games[idx],
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    this._saveRaw(data);
    return data.games[idx];
  }

  deleteGame(id) {
    const data = this._getRaw();
    data.games = data.games.filter(g => g.id !== id);
    this._saveRaw(data);
    return true;
  }

  // --- Aggregated Stats ---
  getStats() {
    const data = this._getRaw();
    const cryptoProjects = data.cryptoProjects || [];
    const games = data.games || [];
    const settings = this.getSettings();

    const whitelists = cryptoProjects.filter(p => p.type === 'Whitelist').length;
    const airdrops = cryptoProjects.filter(p => p.type === 'Airdrop').length;
    
    // Milestones calculation
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const windowEnd = new Date(now.getTime() + (settings.milestoneWindowDays || 30) * 24 * 60 * 60 * 1000);
    const windowEndStr = windowEnd.toISOString().split('T')[0];

    let overdueCount = 0;
    let upcomingCount = 0;

    const checkDate = (dateStr, status) => {
      if (!dateStr) return;
      const isCompleted = ['Completed', 'Dropped', 'Listed', 'Claimable', 'Live'].includes(status);
      if (dateStr < todayStr) {
        if (!isCompleted) overdueCount++;
      } else if (dateStr <= windowEndStr) {
        upcomingCount++;
      }
    };

    cryptoProjects.forEach(p => {
      checkDate(p.releaseDate, p.status);
      checkDate(p.claimDate, p.status);
      checkDate(p.listingDate, p.status);
    });

    games.forEach(g => {
      checkDate(g.gameReleaseDate, g.status);
      checkDate(g.tokenReleaseDate, g.status);
    });

    // Approximate size in KB
    const rawStr = localStorage.getItem(STORAGE_KEY) || '';
    const bytes = new Blob([rawStr]).size;
    const sizeKB = (bytes / 1024).toFixed(1);

    return {
      totalRecords: cryptoProjects.length + games.length,
      cryptoCount: cryptoProjects.length,
      whitelists,
      airdrops,
      gamesCount: games.length,
      upcomingCount,
      overdueCount,
      storageSizeKB: sizeKB,
      lastBackupAt: data.lastBackupAt
    };
  }

  // --- Export / Import JSON Backup ---
  exportJSON() {
    const data = this._getRaw();
    data.lastBackupAt = new Date().toISOString();
    this._saveRaw(data);

    const exportPayload = {
      app: 'QuickSee',
      schemaVersion: '1.0',
      exportedAt: new Date().toISOString(),
      metadata: {
        totalCryptoProjects: data.cryptoProjects.length,
        totalGames: data.games.length
      },
      cryptoProjects: data.cryptoProjects,
      games: data.games
    };

    return JSON.stringify(exportPayload, null, 2);
  }

  importJSON(jsonString, mode = 'replace') {
    let payload;
    try {
      payload = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    } catch (e) {
      throw new Error('Invalid JSON format. Please verify the backup file.');
    }

    if (!payload || (!payload.cryptoProjects && !payload.games)) {
      throw new Error('Unrecognized backup format. Missing cryptoProjects or games arrays.');
    }

    const currentData = this._getRaw();
    const importedCrypto = Array.isArray(payload.cryptoProjects) ? payload.cryptoProjects : [];
    const importedGames = Array.isArray(payload.games) ? payload.games : [];

    if (mode === 'replace') {
      const newData = {
        version: payload.schemaVersion || '1.0',
        createdAt: currentData.createdAt || new Date().toISOString(),
        lastBackupAt: currentData.lastBackupAt,
        cryptoProjects: importedCrypto,
        games: importedGames
      };
      this._saveRaw(newData);
      return {
        importedCryptoCount: importedCrypto.length,
        importedGamesCount: importedGames.length,
        mode: 'replace'
      };
    } else {
      // Merge mode: append records, skip exact ID collisions
      const existingCryptoIds = new Set(currentData.cryptoProjects.map(c => c.id));
      const existingGameIds = new Set(currentData.games.map(g => g.id));

      let addedCrypto = 0;
      importedCrypto.forEach(c => {
        if (!existingCryptoIds.has(c.id)) {
          currentData.cryptoProjects.unshift(c);
          existingCryptoIds.add(c.id);
          addedCrypto++;
        }
      });

      let addedGames = 0;
      importedGames.forEach(g => {
        if (!existingGameIds.has(g.id)) {
          currentData.games.unshift(g);
          existingGameIds.add(g.id);
          addedGames++;
        }
      });

      this._saveRaw(currentData);
      return {
        importedCryptoCount: addedCrypto,
        importedGamesCount: addedGames,
        mode: 'merge'
      };
    }
  }

  clearAllData() {
    const emptyData = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      lastBackupAt: null,
      cryptoProjects: [],
      games: []
    };
    this._saveRaw(emptyData);
  }

  // --- Settings ---
  getSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  updateSettings(newSettings) {
    const current = this.getSettings();
    const merged = { ...current, ...newSettings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
    this._notifyListeners();
    return merged;
  }
}

export const storage = new StorageService();
