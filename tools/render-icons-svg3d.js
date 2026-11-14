const { chromium } = require('playwright'); const fs = require('fs');
const map = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));   // { emoji: [name, colorKey] }
const COL = { gold: ['#ffd36e', '#c98a00'], brown: ['#d8a273', '#7a4a25'], red: ['#ff6b74', '#a8243a'], orange: ['#ffa94d', '#c2541b'], purple: ['#b693ff', '#5a33c0'], blue: ['#78a9ff', '#2350b0'], gray: ['#c7cfdd', '#5a6680'], pink: ['#ff9cc8', '#b83579'], teal: ['#6fe0dd', '#0e7f7e'], green: ['#7fe3a0', '#17834a'], sky: ['#9fd8ff', '#2a7fc4'] };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage(); pg.on('pageerror', e => console.log('E', e.message));
  await pg.goto('http://localhost:8766/iconsrc/svg3d.html'); await pg.waitForFunction(() => window.ready);
  const done = new Set();
  for (const [e, [name, col]] of Object.entries(map)) {
    if (done.has(name)) continue; done.add(name);
    const [c1, c2] = COL[col] || COL.blue;
    try { const u = await pg.evaluate(([n, a, bb]) => window.render3d('/iconsrc/gi/' + n + '.svg', a, bb), [name, c1, c2]); fs.writeFileSync(`/home/user/capital-game/assets/icons/gi_${name}.png`, Buffer.from(u.split(',')[1], 'base64')); process.stdout.write('.'); } catch (err) { console.log('\nFAIL', name, err.message.split('\n')[0]); }
  }
  console.log(' done', done.size); await b.close();
})();
