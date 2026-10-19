/**
 * QuickSee - Automated Logic & Verification Tests
 */

import { parseAnnouncement } from '../js/parser.js';
import { checkDuplicate, normalizeUrl, normalizeContract } from '../js/duplicates.js';
import { getAllMilestones, generateMonthGrid, groupMilestonesByAgenda } from '../js/calendar.js';
import { exportCryptoToCSV, exportGamesToCSV, validateAndMapCSV } from '../js/csv.js';
import { SAMPLE_CRYPTO_PROJECTS, SAMPLE_GAMES } from '../js/sampleData.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

console.log('=== 1. Testing Duplicate Detection ===');
const sampleXUrl = 'https://x.com/monad_xyz/status/1789012345678901234';
const dupByUrl = checkDuplicate(
  { id: 'new_id', name: 'Random Name', xPostLink: sampleXUrl },
  SAMPLE_CRYPTO_PROJECTS,
  'crypto'
);
assert(dupByUrl.isDuplicate && dupByUrl.severity === 'hard', 'Hard duplicate detected for identical normalized X URL');

const dupByCA = checkDuplicate(
  { id: 'new_id_2', name: 'Different Name', contractAddress: '0x0000000000000000000000000000000000001010', network: 'Monad' },
  SAMPLE_CRYPTO_PROJECTS,
  'crypto'
);
assert(dupByCA.isDuplicate && dupByCA.severity === 'hard', 'Hard duplicate detected for identical CA and network');

const dupByName = checkDuplicate(
  { id: 'new_id_3', name: 'monad network' },
  SAMPLE_CRYPTO_PROJECTS,
  'crypto'
);
assert(dupByName.isDuplicate && dupByName.severity === 'soft', 'Soft duplicate warning for normalized project name match');

console.log('\n=== 2. Testing Heuristic Announcement Parser ===');
const rawText = `🚀 Welcome to Berachain Boyco! $BERA token confirmed.
CA: 0x6982508145454Ce325dDbE47a25d4ec3d2311933 on Berachain.
Snapshot finalized. Claim date set for 2026-10-29. Airdrop allocation guaranteed for validators.`;

const parseResult = parseAnnouncement(rawText, 'crypto');
assert(parseResult.candidate.tokenSymbol === '$BERA', `Parsed token symbol $BERA (got ${parseResult.candidate.tokenSymbol})`);
assert(parseResult.candidate.contractAddress.toLowerCase() === '0x6982508145454ce325ddbe47a25d4ec3d2311933', 'Parsed correct EVM contract address');
assert(parseResult.candidate.network === 'Berachain', `Parsed network Berachain (got ${parseResult.candidate.network})`);
assert(parseResult.candidate.type === 'Airdrop', `Identified type as Airdrop (got ${parseResult.candidate.type})`);
assert(parseResult.candidate.claimDate === '2026-10-29', `Parsed claim date 2026-10-29 (got ${parseResult.candidate.claimDate})`);
assert(parseResult.confidence >= 60, `High confidence score: ${parseResult.confidence}%`);

console.log('\n=== 3. Testing Calendar & Milestones ===');
const milestones = getAllMilestones(SAMPLE_CRYPTO_PROJECTS, SAMPLE_GAMES);
assert(milestones.length > 5, `Aggregated ${milestones.length} milestones from sample projects and games`);

const monthGrid = generateMonthGrid(2026, 9, milestones); // October 2026
assert(monthGrid.length === 35 || monthGrid.length === 42, `Month grid generated ${monthGrid.length} cells`);
const oct29Cell = monthGrid.find(c => c.dateStr === '2026-10-29');
assert(oct29Cell && oct29Cell.events.length > 0, 'October 29 milestone correctly placed in day cell');

const agenda = groupMilestonesByAgenda(milestones);
assert(Array.isArray(agenda.overdue) && Array.isArray(agenda.todayAndTomorrow), 'Agenda groupings correctly formed');

console.log('\n=== 4. Testing CSV Serialization & Import Validation ===');
const cryptoCsv = exportCryptoToCSV(SAMPLE_CRYPTO_PROJECTS);
assert(cryptoCsv.includes('Monad Network') && cryptoCsv.includes('contractAddress'), 'Crypto CSV exported with valid headers and data');

const validationResult = validateAndMapCSV(cryptoCsv, 'crypto', SAMPLE_CRYPTO_PROJECTS);
assert(validationResult.duplicateRows.length === SAMPLE_CRYPTO_PROJECTS.length, `Correctly identified existing duplicates during CSV import preview (${validationResult.duplicateRows.length})`);

const gamesCsv = exportGamesToCSV(SAMPLE_GAMES);
assert(gamesCsv.includes('Illuvium') && gamesCsv.includes('tokenPrice'), 'Games CSV exported with headers and data');

console.log('\n=============================================');
console.log(`Test Results: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All verification tests passed perfectly!');
  process.exit(0);
}
