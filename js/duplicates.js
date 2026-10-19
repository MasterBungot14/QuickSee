/**
 * QuickSee - Duplicate Detection Engine
 * Strictly follows Client Brief Section 10 hierarchy:
 * 1. Normalized X post link (Crypto)
 * 2. Normalized game/project link
 * 3. Normalized Contract Address + Network
 * 4. Normalized project/game name + category (soft warning)
 */

export function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let cleaned = url.trim().toLowerCase();
  // Strip protocol
  cleaned = cleaned.replace(/^https?:\/\//, '');
  // Strip www
  cleaned = cleaned.replace(/^www\./, '');
  // Normalize twitter.com to x.com
  cleaned = cleaned.replace(/^twitter\.com/, 'x.com');
  // Strip query parameters and hashes
  cleaned = cleaned.split('?')[0].split('#')[0];
  // Strip trailing slashes
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
}

export function normalizeContract(ca) {
  if (!ca || typeof ca !== 'string') return '';
  return ca.trim().toLowerCase();
}

export function normalizeName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Checks a candidate record against existing records.
 * Returns { isDuplicate: boolean, severity: 'hard' | 'soft' | null, reason: string, matchedRecord: object | null }
 */
export function checkDuplicate(candidate, existingRecords, recordType = 'crypto', isEditingExisting = false) {
  if (!candidate || !existingRecords || !existingRecords.length) {
    return { isDuplicate: false, severity: null, reason: '', matchedRecord: null };
  }

  // Helper to filter out self only if editing existing record
  const isMatchTarget = (r) => {
    if (isEditingExisting && candidate.id && r.id === candidate.id) {
      return false;
    }
    return true;
  };

  // 0. Check exact ID collision for imports
  if (!isEditingExisting && candidate.id) {
    const idMatch = existingRecords.find(r => r.id === candidate.id);
    if (idMatch) {
      return {
        isDuplicate: true,
        severity: 'hard',
        reason: `Record with identical ID (${candidate.id}) already exists: "${idMatch.name}".`,
        matchedRecord: idMatch
      };
    }
  }

  // 1. Check exact normalized X post link for Crypto Projects
  if (recordType === 'crypto' && candidate.xPostLink) {
    const candidateX = normalizeUrl(candidate.xPostLink);
    if (candidateX) {
      const match = existingRecords.find(r => isMatchTarget(r) && normalizeUrl(r.xPostLink) === candidateX);
      if (match) {
        return {
          isDuplicate: true,
          severity: 'hard',
          reason: `Exact X/Twitter post link already saved in record "${match.name}".`,
          matchedRecord: match
        };
      }
    }
  }

  // 2. Check exact normalized game/project link
  const candidateLink = candidate.officialLink || candidate.xPostLink;
  if (candidateLink) {
    const normLink = normalizeUrl(candidateLink);
    if (normLink) {
      const match = existingRecords.find(r => {
        if (!isMatchTarget(r)) return false;
        const rLink = normalizeUrl(r.officialLink || r.xPostLink);
        return rLink && rLink === normLink;
      });
      if (match) {
        return {
          isDuplicate: true,
          severity: 'hard',
          reason: `Exact official / announcement URL matches existing record "${match.name}".`,
          matchedRecord: match
        };
      }
    }
  }

  // 3. Normalized contract address plus network (when a CA exists)
  if (candidate.contractAddress && candidate.network) {
    const normCA = normalizeContract(candidate.contractAddress);
    const normNet = candidate.network.trim().toLowerCase();
    if (normCA.length >= 8 && normNet) {
      const match = existingRecords.find(r => {
        if (!isMatchTarget(r)) return false;
        const rCA = normalizeContract(r.contractAddress);
        const rNet = (r.network || '').trim().toLowerCase();
        return rCA && rNet && rCA === normCA && rNet === normNet;
      });
      if (match) {
        return {
          isDuplicate: true,
          severity: 'hard',
          reason: `Token Contract Address (${candidate.contractAddress.slice(0, 10)}...) on ${candidate.network} already exists for "${match.name}".`,
          matchedRecord: match
        };
      }
    }
  }

  // 4. Normalized project/game name plus record category as a softer warning
  if (candidate.name) {
    const normName = normalizeName(candidate.name);
    if (normName.length >= 3) {
      const match = existingRecords.find(r => {
        if (!isMatchTarget(r)) return false;
        return normalizeName(r.name) === normName;
      });
      if (match) {
        return {
          isDuplicate: true,
          severity: 'soft',
          reason: `Similar project name "${match.name}" already tracked in your records.`,
          matchedRecord: match
        };
      }
    }
  }

  return { isDuplicate: false, severity: null, reason: '', matchedRecord: null };
}
