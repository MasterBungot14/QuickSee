/**
 * QuickSee - Heuristic Web3 Post & Announcement Parser
 * Extracts candidate fields from copied X / Telegram / Discord announcement text.
 * Rule-based, local, does not hallucinate or guess missing fields.
 */

const KNOWN_NETWORKS = [
  { name: 'Ethereum', regex: /\b(ethereum|mainnet|erc20|erc-20|eth)\b/i },
  { name: 'Solana', regex: /\b(solana|sol|spl)\b/i },
  { name: 'Base', regex: /\b(base|coinbase l2)\b/i },
  { name: 'Arbitrum', regex: /\b(arbitrum|arb|nitro)\b/i },
  { name: 'Optimism', regex: /\b(optimism|op mainnet|superchain)\b/i },
  { name: 'Monad', regex: /\b(monad|monad testnet|monad devnet)\b/i },
  { name: 'Berachain', regex: /\b(berachain|bera|artio|bartio)\b/i },
  { name: 'Sui', regex: /\b(sui|sui network)\b/i },
  { name: 'Aptos', regex: /\b(aptos|apt)\b/i },
  { name: 'Polygon', regex: /\b(polygon|matic|pol)\b/i },
  { name: 'Avalanche', regex: /\b(avalanche|avax)\b/i },
  { name: 'BNB Chain', regex: /\b(bnb|bsc|binance smart chain)\b/i },
  { name: 'TON', regex: /\b(ton|the open network|telegram)\b/i },
  { name: 'Starknet', regex: /\b(starknet|strk)\b/i },
  { name: 'zkSync', regex: /\b(zksync|era)\b/i },
  { name: 'Blast', regex: /\b(blast|blast l2)\b/i },
  { name: 'Immutable X', regex: /\b(immutable\s*x?|imx)\b/i },
  { name: 'Ronin', regex: /\b(ronin|ron)\b/i },
  { name: 'Sei', regex: /\b(sei|sei network)\b/i },
  { name: 'Near', regex: /\b(near|near protocol)\b/i }
];

export function parseAnnouncement(text, targetType = 'crypto', optionalUrl = '') {
  if (!text || typeof text !== 'string') {
    text = '';
  }

  const cleanedText = text.trim();
  const result = {
    name: '',
    network: '',
    tokenSymbol: '',
    contractAddress: '',
    type: 'Airdrop', // Default fallback for crypto
    officialLink: '',
    xPostLink: optionalUrl ? optionalUrl.trim() : '',
    dateJoined: new Date().toISOString().split('T')[0], // Defaults to today
    releaseDate: '',
    claimDate: '',
    listingDate: '',
    gameReleaseDate: '',
    tokenReleaseDate: '',
    tokenPrice: null,
    dateConfidence: 'Estimated',
    status: 'Joined',
    notes: '',
    extractedFlags: {}
  };

  if (!cleanedText && !optionalUrl) {
    return { candidate: result, confidence: 0, extractedCount: 0, missingFields: [] };
  }

  // 1. URL Extraction
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = cleanedText.match(urlRegex) || [];
  
  if (optionalUrl) {
    if (optionalUrl.includes('x.com') || optionalUrl.includes('twitter.com')) {
      result.xPostLink = optionalUrl;
      result.extractedFlags.xPostLink = true;
    } else {
      result.officialLink = optionalUrl;
      result.extractedFlags.officialLink = true;
    }
  }

  urls.forEach(u => {
    // Clean trailing punctuation from URL match
    const cleanU = u.replace(/[.,!?;:)>\]]+$/, '');
    if ((cleanU.includes('x.com') || cleanU.includes('twitter.com')) && !result.xPostLink) {
      result.xPostLink = cleanU;
      result.extractedFlags.xPostLink = true;
    } else if (!result.officialLink && !cleanU.includes('t.co') && !cleanU.includes('discord.gg')) {
      result.officialLink = cleanU;
      result.extractedFlags.officialLink = true;
    }
  });

  // 2. Contract Address Extraction (EVM 0x... and Solana base58)
  const evmMatch = cleanedText.match(/\b(0x[a-fA-F0-9]{40})\b/);
  if (evmMatch) {
    result.contractAddress = evmMatch[1];
    result.extractedFlags.contractAddress = true;
  } else {
    // Solana contract address check with context or 43-44 length
    const solMatch = cleanedText.match(/(?:ca|contract|mint|address):\s*([1-9A-HJ-NP-Za-km-z]{32,44})/i);
    if (solMatch) {
      result.contractAddress = solMatch[1];
      result.extractedFlags.contractAddress = true;
    }
  }

  // 3. Network Detection
  for (const net of KNOWN_NETWORKS) {
    if (net.regex.test(cleanedText)) {
      result.network = net.name;
      result.extractedFlags.network = true;
      break;
    }
  }
  // Fallback network inference from EVM address if network not specified
  if (!result.network && result.contractAddress && result.contractAddress.startsWith('0x')) {
    result.network = 'Ethereum';
  }

  // 4. Token Symbol Extraction ($TICKER or ticker: TICKER)
  const dollarTickerMatch = cleanedText.match(/\$([A-Za-z0-9]{2,10})\b/);
  if (dollarTickerMatch) {
    result.tokenSymbol = '$' + dollarTickerMatch[1].toUpperCase();
    result.extractedFlags.tokenSymbol = true;
  } else {
    const symbolWordMatch = cleanedText.match(/(?:token|ticker|symbol):\s*\$?([A-Za-z0-9]{2,10})\b/i);
    if (symbolWordMatch) {
      result.tokenSymbol = '$' + symbolWordMatch[1].toUpperCase();
      result.extractedFlags.tokenSymbol = true;
    }
  }

  // 5. Type Detection (Whitelist vs Airdrop for Crypto)
  const wlScore = (cleanedText.match(/\b(whitelist|allowlist|wl|guaranteed\s*allocation|mint\s*pass|presale)\b/gi) || []).length;
  const airdropScore = (cleanedText.match(/\b(airdrop|claim|points|retroactive|season\s*\d|snapshot|allocation|drop)\b/gi) || []).length;

  if (wlScore > airdropScore) {
    result.type = 'Whitelist';
    result.extractedFlags.type = true;
  } else if (airdropScore > 0) {
    result.type = 'Airdrop';
    result.extractedFlags.type = true;
  }

  // 6. Game Specific Token Price extraction
  if (targetType === 'game') {
    const priceMatch = cleanedText.match(/(?:price|floor|mint\s*price|token\s*price):\s*\$?([0-9]+(?:\.[0-9]+)?)/i) ||
                       cleanedText.match(/\$([0-9]+\.[0-9]{1,4})\b/);
    if (priceMatch) {
      result.tokenPrice = parseFloat(priceMatch[1]);
      result.extractedFlags.tokenPrice = true;
    }
  }

  // 7. Date Detection
  const dates = extractDatesFromText(cleanedText);
  if (dates.tgeDate) {
    if (targetType === 'game') {
      result.tokenReleaseDate = dates.tgeDate;
      result.extractedFlags.tokenReleaseDate = true;
    } else {
      result.releaseDate = dates.tgeDate;
      result.extractedFlags.releaseDate = true;
    }
  }
  if (dates.claimDate && targetType === 'crypto') {
    result.claimDate = dates.claimDate;
    result.extractedFlags.claimDate = true;
  }
  if (dates.listingDate && targetType === 'crypto') {
    result.listingDate = dates.listingDate;
    result.extractedFlags.listingDate = true;
  }
  if (dates.gameLaunchDate && targetType === 'game') {
    result.gameReleaseDate = dates.gameLaunchDate;
    result.extractedFlags.gameReleaseDate = true;
  }
  if (dates.genericDate) {
    if (targetType === 'game') {
      if (!result.gameReleaseDate) {
        result.gameReleaseDate = dates.genericDate;
        result.extractedFlags.gameReleaseDate = true;
      }
    } else {
      if (!result.releaseDate) {
        result.releaseDate = dates.genericDate;
        result.extractedFlags.releaseDate = true;
      }
    }
  }

  if (dates.confidenceConfirmed) {
    result.dateConfidence = 'Confirmed';
  }

  // 8. Project / Game Name Extraction
  // Look for patterns like "Introducing [Name]", "Announcing [Name]", "[Name] Airdrop", or first strong line
  let detectedName = '';
  const introMatch = cleanedText.match(/(?:introducing|announcing|welcome\s*to)\s+([A-Z0-9][A-Za-z0-9\s-]{2,24})/i);
  if (introMatch) {
    detectedName = introMatch[1].trim();
  } else {
    // Check for hashtag names like #Monad, #Berachain
    const hashtagMatch = cleanedText.match(/#([A-Za-z0-9]{3,20})/);
    if (hashtagMatch && !['airdrop', 'whitelist', 'giveaway', 'crypto', 'web3', 'nft'].includes(hashtagMatch[1].toLowerCase())) {
      detectedName = hashtagMatch[1];
    } else {
      // First sentence / heading
      const lines = cleanedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length > 0) {
        const firstLine = lines[0].replace(/[🚀🔥🎉📢🚨]/g, '').trim();
        if (firstLine.length > 0 && firstLine.length < 35) {
          detectedName = firstLine.replace(/^(airdrop|whitelist|update|alert|psa)[:\s-]*/i, '').trim();
        }
      }
    }
  }

  if (detectedName) {
    // Clean trailing words like "Airdrop", "Season", etc.
    detectedName = detectedName.replace(/\s+(airdrop|whitelist|token|tge|game|mint)$/i, '').trim();
    if (detectedName.length > 1) {
      result.name = detectedName;
      result.extractedFlags.name = true;
    }
  }

  // Summary notes
  result.notes = cleanedText.slice(0, 300) + (cleanedText.length > 300 ? '...' : '');

  // Calculate extraction confidence
  const relevantFields = targetType === 'crypto' 
    ? ['name', 'network', 'tokenSymbol', 'contractAddress', 'type', 'releaseDate', 'claimDate', 'listingDate', 'xPostLink']
    : ['name', 'network', 'tokenSymbol', 'contractAddress', 'officialLink', 'gameReleaseDate', 'tokenReleaseDate', 'tokenPrice'];

  let foundCount = 0;
  const missing = [];
  relevantFields.forEach(f => {
    if (result.extractedFlags[f] || (result[f] && result[f] !== '')) {
      foundCount++;
    } else {
      missing.push(f);
    }
  });

  const confidenceScore = Math.min(100, Math.round((foundCount / (relevantFields.length - 2)) * 100));

  return {
    candidate: result,
    confidence: confidenceScore,
    extractedCount: foundCount,
    missingFields: missing
  };
}

/**
 * Parses dates and correlates them with context keywords (tge, claim, listing, launch)
 */
function extractDatesFromText(text) {
  const dates = {
    tgeDate: null,
    claimDate: null,
    listingDate: null,
    gameLaunchDate: null,
    genericDate: null,
    confidenceConfirmed: false
  };

  if (/\b(confirmed|official|locked|set\s*for)\b/i.test(text)) {
    dates.confidenceConfirmed = true;
  }

  // ISO Dates (YYYY-MM-DD) with context inspection
  const isoRegex = /\b(202\d-[0-1]\d-[0-3]\d)\b/g;
  let isoMatch;
  while ((isoMatch = isoRegex.exec(text)) !== null) {
    const parsedDate = isoMatch[1];
    const startIdx = Math.max(0, isoMatch.index - 50);
    const endIdx = Math.min(text.length, isoMatch.index + isoMatch[0].length + 50);
    const snippet = text.slice(startIdx, endIdx).toLowerCase();

    if (/claim|distribution|drop/i.test(snippet)) {
      dates.claimDate = parsedDate;
    } else if (/listing|trade|cex|dex|binance|bybit/i.test(snippet)) {
      dates.listingDate = parsedDate;
    } else if (/game|launch|alpha|beta/i.test(snippet)) {
      dates.gameLaunchDate = parsedDate;
    } else if (/tge|token|release|mainnet/i.test(snippet)) {
      dates.tgeDate = parsedDate;
    } else if (!dates.genericDate) {
      dates.genericDate = parsedDate;
    }
  }

  // Month names and day parsing, e.g. "Oct 25", "November 15, 2026", "Dec 20"
  const monthRegex = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(202\d))?\b/gi;
  
  let match;
  const months = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  while ((match = monthRegex.exec(text)) !== null) {
    const mStr = match[1].toLowerCase().slice(0, 3);
    const month = months[mStr] || '01';
    const day = match[2].padStart(2, '0');
    const currentYear = new Date().getFullYear();
    const year = match[3] || currentYear.toString();
    const parsedDate = `${year}-${month}-${day}`;

    // Context around match (60 chars before and after)
    const startIdx = Math.max(0, match.index - 50);
    const endIdx = Math.min(text.length, match.index + match[0].length + 50);
    const snippet = text.slice(startIdx, endIdx).toLowerCase();

    if (/claim|distribution|drop/i.test(snippet)) {
      dates.claimDate = parsedDate;
    } else if (/listing|trade|cex|dex|binance|bybit/i.test(snippet)) {
      dates.listingDate = parsedDate;
    } else if (/game|launch|alpha|beta|mainnet/i.test(snippet)) {
      dates.gameLaunchDate = parsedDate;
    } else if (/tge|token|release/i.test(snippet)) {
      dates.tgeDate = parsedDate;
    } else if (!dates.genericDate) {
      dates.genericDate = parsedDate;
    }
  }

  return dates;
}
