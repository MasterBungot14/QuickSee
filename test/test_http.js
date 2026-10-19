/**
 * QuickSee - HTTP Server Endpoint & Asset Verification
 */

async function testEndpoints() {
  const urls = [
    'http://localhost:3000/',
    'http://localhost:3000/index.html',
    'http://localhost:3000/css/variables.css',
    'http://localhost:3000/css/main.css',
    'http://localhost:3000/css/components.css',
    'http://localhost:3000/css/responsive.css',
    'http://localhost:3000/js/app.js',
    'http://localhost:3000/js/storage.js',
    'http://localhost:3000/js/parser.js',
    'http://localhost:3000/js/duplicates.js',
    'http://localhost:3000/js/calendar.js',
    'http://localhost:3000/js/csv.js',
    'http://localhost:3000/js/sampleData.js',
    'http://localhost:3000/js/ui.js',
    'http://localhost:3000/assets/favicon.svg'
  ];

  console.log('Testing QuickSee Server Endpoints...');
  let allOk = true;

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.status === 200) {
        console.log(`  [200 OK] ${url} (${res.headers.get('content-type')})`);
      } else {
        console.error(`  [FAIL ${res.status}] ${url}`);
        allOk = false;
      }
    } catch (err) {
      console.error(`  [CONNECTION ERROR] ${url}: ${err.message}`);
      allOk = false;
    }
  }

  if (allOk) {
    console.log('\nAll 15 endpoints & static assets responded with 200 OK!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

testEndpoints();
