const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 4173;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8'
};

function createStaticServer() {
  return http.createServer((req, res) => {
    const cleanPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const relative = cleanPath === '/' ? 'game.html' : cleanPath.replace(/^\/+/, '');
    const filePath = path.join(ROOT, relative);

    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(error.code === 'ENOENT' ? 404 : 500, {
          'Content-Type': 'text/plain; charset=utf-8'
        });
        res.end(error.code === 'ENOENT' ? 'Not found' : 'Server error');
        return;
      }

      res.writeHead(200, {
        'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
      });
      res.end(data);
    });
  });
}

async function main() {
  const server = createStaticServer();
  await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  const results = [];

  const record = (name, pass, detail) => {
    results.push({ name, pass, detail: detail || '' });
  };

  try {
    await page.goto(`http://127.0.0.1:${PORT}/game.html`);
    await page.waitForLoadState('domcontentloaded');

    await page.evaluate(() => {
      localStorage.removeItem('refineryRunProgress');
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1200);

    const activeScreensOnBoot = await page.locator('.screen.active').count();
    record('Boot has exactly one active screen', activeScreensOnBoot === 1, `count=${activeScreensOnBoot}`);

    const factsButton = page.locator('button', { hasText: 'Just the Facts' });
    const factsButtonVisible = await factsButton.isVisible().catch(() => false);
    record('Splash screen shows the Just the Facts button', factsButtonVisible, '');

    const factsNoteVisible = await page.getByText('Browse every refinery fun fact. No gameplay. No V-804 credit.').isVisible().catch(() => false);
    record('Splash screen explains that facts mode bypasses gameplay credit', factsNoteVisible, '');

    const savedProgressBeforeFacts = await page.evaluate(() => localStorage.getItem('refineryRunProgress'));
    await factsButton.click();
    await page.waitForTimeout(250);
    const factsOverlayVisible = await page.locator('#fun-fact-overlay.active').count();
    record('Just the Facts opens the fact browser overlay', factsOverlayVisible === 1, `count=${factsOverlayVisible}`);

    const factCounterStart = await page.locator('#fun-fact-counter').textContent().catch(() => '');
    record('Facts browser starts on the first fact', Boolean(factCounterStart && factCounterStart.includes('1 /')), `counter=${factCounterStart}`);

    const firstFactText = await page.locator('#fun-fact-text').textContent();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(150);
    const secondFactText = await page.locator('#fun-fact-text').textContent();
    record('Facts browser can advance to the next fact', firstFactText !== secondFactText, '');

    await page.getByRole('button', { name: 'Previous' }).click();
    await page.waitForTimeout(150);
    const previousFactText = await page.locator('#fun-fact-text').textContent();
    record('Facts browser can go back to the previous fact', previousFactText === firstFactText, '');

    for (let i = 0; i < 60; i += 1) {
      const nextDisabled = await page.getByRole('button', { name: 'Next' }).isDisabled().catch(() => false);
      if (nextDisabled) break;
      await page.getByRole('button', { name: 'Next' }).click();
      await page.waitForTimeout(60);
    }
    const lastCounter = await page.locator('#fun-fact-counter').textContent().catch(() => '');
    const lastFactText = await page.locator('#fun-fact-text').textContent().catch(() => '');
    record('Facts browser can reach the logistics and finale tail entries', Boolean(lastCounter && /\/ \d+$/.test(lastCounter) && lastFactText.includes('No single transport mode does it all')), `counter=${lastCounter} text=${lastFactText}`);

    await page.getByRole('button', { name: 'Close' }).click();
    await page.waitForTimeout(250);
    const factsOverlayAfterClose = await page.locator('#fun-fact-overlay.active').count();
    record('Closing facts browser returns to the entry screen state', factsOverlayAfterClose === 0, `count=${factsOverlayAfterClose}`);

    const savedProgressAfterFacts = await page.evaluate(() => localStorage.getItem('refineryRunProgress'));
    record('Browsing facts does not mutate saved progress', savedProgressBeforeFacts === savedProgressAfterFacts, `before=${savedProgressBeforeFacts} after=${savedProgressAfterFacts}`);

    const factEntries = await page.evaluate(() => window.Game.__debug.getFactBrowserEntries());
    const neutralTruckFact = factEntries.find(entry => entry.key === 'logistics_truck');
    const hasUlsdFacts = factEntries.some(entry => entry.key === 'ulsd_lub');
    const hasJetFacts = factEntries.some(entry => entry.key === 'jet_flash');
    const hasGasGradeFacts = factEntries.some(entry => entry.key === 'gas_grade_87summer');
    record('Facts browser uses neutral logistics wording', Boolean(neutralTruckFact && !/^Great choice!|^Awesome!|^Smart pick!|^Great thinking!|^Excellent!/i.test(neutralTruckFact.text)), neutralTruckFact ? neutralTruckFact.text : 'missing');

    const tuningSnapshot = await page.evaluate(() => window.Game.__debug.getTuningSnapshot());
    record('Desalter ultra-fast tier is disabled', tuningSnapshot.desalter.allowUltraFast === false, JSON.stringify(tuningSnapshot.desalter));
    record('Facts browser includes route, logistics, finale, ULSD, Jet, and gasoline facts', tuningSnapshot.factsBrowserCount >= 46 && hasUlsdFacts && hasJetFacts && hasGasGradeFacts, `count=${tuningSnapshot.factsBrowserCount}`);
    record('Hydrotreating top speed is clamped below the old cap', tuningSnapshot.hydrotreating.maxSpeedMax < 7, JSON.stringify(tuningSnapshot.hydrotreating));
    const smokeResults = await page.evaluate(async () => window.Game.__debug.runSmokeSuite());
    smokeResults.forEach(result => {
      record(`Smoke: ${result.name}`, Boolean(result.pass), JSON.stringify(result.snapshot));
    });

    await page.evaluate(() => window.Game.mapJump('4', 'gasoline'));
    await page.waitForTimeout(900);
    const gasIntroVisible = await page.locator('.gasoline-intro-overlay').isVisible().catch(() => false);
    record('Gasoline game shows the intro explainer on entry', gasIntroVisible, '');
    if (gasIntroVisible) {
      await page.getByRole('button', { name: 'Start Blending' }).click();
      await page.waitForTimeout(150);
    }
    const costTags = await page.locator('.comp-cost-tag').count();
    const blendReadoutText = await page.locator('#blend-live-readout').textContent().catch(() => '');
    record('Gasoline component cards show cost tiers', costTags >= 5, `count=${costTags}`);
    record('Gasoline live blend HUD includes cost readout', Boolean(blendReadoutText && blendReadoutText.includes('Cost')), `text=${blendReadoutText}`);

    await page.evaluate(() => window.Game.showPhase('sru', { skipSave: true }));
    await page.waitForTimeout(600);
    const sruVisible = await page.locator('#sru-stage').isVisible();
    record('SRU stage renders', sruVisible, '');

    const startShiftButton = page.getByRole('button', { name: /Start .*Shift/ });
    try {
      await startShiftButton.waitFor({ state: 'visible', timeout: 2500 });
    } catch (error) {
      const overlayHtml = await page.locator('#sru-overlay').innerHTML().catch(() => 'overlay-missing');
      const activeScreenId = await page.locator('.screen.active').evaluate(el => el.id).catch(() => 'none');
      record('SRU start shift button is visible', false, `active=${activeScreenId} overlay=${overlayHtml}`);
      throw error;
    }

    await startShiftButton.click();
    await page.waitForTimeout(500);
    const countdownVisible = await page.getByText('Set feed, air, and drain before the sulfur shift swings.').isVisible();
    record('SRU shift starts from overlay', countdownVisible, '');

    await page.waitForTimeout(3200);

    const airMatchChipVisible = await page.locator('#sru-air-match-readout').isVisible().catch(() => false);
    const sealLevelChipVisible = await page.locator('#sru-level-readout').isVisible().catch(() => false);
    record('SRU live metric chips render during play', airMatchChipVisible && sealLevelChipVisible, '');

    await page.getByRole('button', { name: 'High' }).click();
    await page.waitForTimeout(200);
    const feedLabel = await page.locator('#sru-feed-value').textContent();
    record('SRU feed band buttons update multiplier label', Boolean(feedLabel && feedLabel.includes('High')), `label=${feedLabel}`);

    const beforeAir = await page.locator('#sru-air-input').inputValue();
    const airBox = await page.locator('#sru-air-input').boundingBox();
    if (!airBox) {
      record('SRU air slider bounding box exists', false, 'boundingBox=null');
    } else {
      await page.mouse.move(airBox.x + 8, airBox.y + airBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(airBox.x + airBox.width - 8, airBox.y + airBox.height / 2, { steps: 18 });
      await page.mouse.up();
      await page.waitForTimeout(250);
      const afterAir = await page.locator('#sru-air-input').inputValue();
      record('SRU air damper responds to drag', beforeAir !== afterAir, `before=${beforeAir}, after=${afterAir}`);
    }

    const beforeDrain = await page.locator('#sru-drain-input').inputValue();
    const drainBox = await page.locator('#sru-drain-input').boundingBox();
    if (!drainBox) {
      record('SRU drain slider bounding box exists', false, 'boundingBox=null');
    } else {
      await page.mouse.move(drainBox.x + drainBox.width - 8, drainBox.y + drainBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(drainBox.x + 12, drainBox.y + drainBox.height / 2, { steps: 16 });
      await page.mouse.up();
      await page.waitForTimeout(250);
      const afterDrain = await page.locator('#sru-drain-input').inputValue();
      record('SRU drain valve responds to drag', beforeDrain !== afterDrain, `before=${beforeDrain}, after=${afterDrain}`);
    }

    await page.evaluate(() => window.Game.showPhase('sru', { skipSave: true }));
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /Start .*Shift/ }).click();
    await page.waitForTimeout(3200);
    await page.getByRole('button', { name: 'High' }).click();
    const tripAirBox = await page.locator('#sru-air-input').boundingBox();
    if (!tripAirBox) {
      record('SRU heater trip setup air slider exists', false, 'boundingBox=null');
    } else {
      await page.mouse.move(tripAirBox.x + tripAirBox.width - 8, tripAirBox.y + tripAirBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(tripAirBox.x + 8, tripAirBox.y + tripAirBox.height / 2, { steps: 18 });
      await page.mouse.up();
      await page.waitForTimeout(2200);
      const heaterTripVisible = await page.getByRole('heading', { name: 'Heater Trip' }).isVisible().catch(() => false);
      record('SRU severe under-air triggers Heater Trip', heaterTripVisible, '');
      const resultScrollState = await page.evaluate(() => {
        const card = document.querySelector('.sru-overlay-card--result');
        if (!card) return null;
        return {
          scrollHeight: card.scrollHeight,
          clientHeight: card.clientHeight,
          overflowY: window.getComputedStyle(card).overflowY
        };
      });
      record(
        'SRU result overlay stays contained with scroll enabled',
        Boolean(resultScrollState && resultScrollState.clientHeight > 0 && ['auto', 'scroll'].includes(resultScrollState.overflowY)),
        JSON.stringify(resultScrollState)
      );
    }

    await page.evaluate(() => window.Game.mapJump('pipe-xray', 'diesel'));
    await page.waitForTimeout(900);
    const pipeXrayActive = await page.locator('#phase-pipe-xray.active').count();
    record('Pipe X-Ray map jump activates screen', pipeXrayActive === 1, `count=${pipeXrayActive}`);

    await page.evaluate(() => window.Game.mapJump('pump-swap', 'jetfuel'));
    await page.waitForTimeout(900);
    const pumpSwapActive = await page.locator('#phase-pump-swap.active').count();
    record('Pump Swap map jump activates screen', pumpSwapActive === 1, `count=${pumpSwapActive}`);

    await page.evaluate(() => window.Game.mapJump('4', 'gasoline'));
    await page.waitForTimeout(900);
    const phase4Active = await page.locator('#phase-4.active').count();
    record('Phase 4 gasoline map jump activates certification screen', phase4Active === 1, `count=${phase4Active}`);

    await page.evaluate(() => window.Game.mapJump('5', 'gasoline'));
    await page.waitForTimeout(900);
    const phase5Active = await page.locator('#phase-5.active').count();
    record('Phase 5 logistics map jump activates logistics screen', phase5Active === 1, `count=${phase5Active}`);

    await page.evaluate(() => window.Game.mapJump('3', 'diesel'));
    await page.waitForTimeout(1200);
    const sulfurAtoms = await page.locator('#sulfur-container .physics-body').count();
    record('Hydrotreating still spawns sulfur atoms after map jump', sulfurAtoms > 0, `count=${sulfurAtoms}`);

    console.table(results);

    const failed = results.filter(result => !result.pass);
    if (failed.length) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

















