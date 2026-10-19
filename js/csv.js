/**
 * QuickSee - CSV Portability Engine
 * RFC 4180 compliant CSV serializer, parser, validator, and preview generator.
 */

import { checkDuplicate } from './duplicates.js';

export const CRYPTO_CSV_HEADERS = [
  'id', 'name', 'type', 'network', 'tokenSymbol', 'contractAddress',
  'xPostLink', 'dateJoined', 'releaseDate', 'claimDate', 'listingDate',
  'dateConfidence', 'status', 'notes', 'createdAt', 'updatedAt'
];

export const GAMES_CSV_HEADERS = [
  'id', 'name', 'network', 'officialLink', 'tokenSymbol', 'tokenPrice',
  'contractAddress', 'dateJoined', 'gameReleaseDate', 'tokenReleaseDate',
  'dateConfidence', 'status', 'notes', 'createdAt', 'updatedAt'
];

function escapeCSV(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

export function exportCryptoToCSV(cryptoProjects) {
  const rows = [CRYPTO_CSV_HEADERS.join(',')];
  cryptoProjects.forEach(p => {
    const row = CRYPTO_CSV_HEADERS.map(h => escapeCSV(p[h] || ''));
    rows.push(row.join(','));
  });
  return rows.join('\r\n');
}

export function exportGamesToCSV(games) {
  const rows = [GAMES_CSV_HEADERS.join(',')];
  games.forEach(g => {
    const row = GAMES_CSV_HEADERS.map(h => escapeCSV(g[h] !== null && g[h] !== undefined ? g[h] : ''));
    rows.push(row.join(','));
  });
  return rows.join('\r\n');
}

/**
 * Standard RFC 4180 CSV parser supporting escaped quotes and multi-line cells.
 */
export function parseCSV(csvText) {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n of CRLF
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(c => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Validates and maps parsed CSV rows to records with duplicate detection.
 */
export function validateAndMapCSV(csvText, expectedType = 'crypto', existingRecords = []) {
  const rows = parseCSV(csvText);
  if (rows.length < 2) {
    throw new Error('CSV file is empty or does not contain header and data rows.');
  }

  const headerRow = rows[0].map(h => h.replace(/^["']|["']$/g, '').trim());
  const expectedHeaders = expectedType === 'crypto' ? CRYPTO_CSV_HEADERS : GAMES_CSV_HEADERS;

  // Verify critical header columns
  const hasName = headerRow.some(h => /name/i.test(h));
  if (!hasName) {
    throw new Error(`Invalid CSV structure. Missing required column 'name'. Found headers: ${headerRow.join(', ')}`);
  }

  // Map header index
  const headerMap = {};
  headerRow.forEach((h, idx) => {
    headerMap[h.toLowerCase()] = idx;
  });

  const validRecords = [];
  const rejectedRows = [];
  const duplicateRows = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const getVal = (colName) => {
      const idx = headerMap[colName.toLowerCase()];
      return idx !== undefined && row[idx] !== undefined ? row[idx].replace(/^["']|["']$/g, '').trim() : '';
    };

    const name = getVal('name');
    if (!name) {
      rejectedRows.push({ rowNumber: i + 1, reason: 'Missing required field: name', data: row });
      continue;
    }

    const now = new Date().toISOString();
    let record;

    if (expectedType === 'crypto') {
      const rawType = getVal('type');
      const normalizedType = /whitelist/i.test(rawType) ? 'Whitelist' : 'Airdrop';

      record = {
        id: getVal('id') || 'cp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        name,
        type: normalizedType,
        network: getVal('network') || 'Ethereum',
        tokenSymbol: getVal('tokensymbol'),
        contractAddress: getVal('contractaddress'),
        xPostLink: getVal('xpostlink'),
        dateJoined: getVal('datejoined') || now.split('T')[0],
        releaseDate: getVal('releasedate'),
        claimDate: getVal('claimdate'),
        listingDate: getVal('listingdate'),
        dateConfidence: /confirmed/i.test(getVal('dateconfidence')) ? 'Confirmed' : 'Estimated',
        status: getVal('status') || 'Joined',
        notes: getVal('notes'),
        createdAt: getVal('createdat') || now,
        updatedAt: now
      };
    } else {
      const rawPrice = getVal('tokenprice');
      record = {
        id: getVal('id') || 'gm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        name,
        network: getVal('network') || 'Immutable X',
        officialLink: getVal('officiallink'),
        tokenSymbol: getVal('tokensymbol'),
        tokenPrice: rawPrice && !isNaN(Number(rawPrice)) ? Number(rawPrice) : null,
        contractAddress: getVal('contractaddress'),
        dateJoined: getVal('datejoined') || now.split('T')[0],
        gameReleaseDate: getVal('gamereleasedate'),
        tokenReleaseDate: getVal('tokenreleasedate'),
        dateConfidence: /confirmed/i.test(getVal('dateconfidence')) ? 'Confirmed' : 'Estimated',
        status: getVal('status') || 'Researching',
        notes: getVal('notes'),
        createdAt: getVal('createdat') || now,
        updatedAt: now
      };
    }

    // Check duplicate against existing
    const dupCheck = checkDuplicate(record, existingRecords, expectedType);
    if (dupCheck.isDuplicate) {
      duplicateRows.push({
        rowNumber: i + 1,
        record,
        reason: dupCheck.reason,
        matchedName: dupCheck.matchedRecord ? dupCheck.matchedRecord.name : 'Unknown'
      });
    } else {
      validRecords.push(record);
    }
  }

  return {
    totalRows: rows.length - 1,
    validRecords,
    duplicateRows,
    rejectedRows
  };
}
