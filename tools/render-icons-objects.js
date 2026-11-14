const { chromium } = require('playwright'); const fs = require('fs');
const map = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage(); pg.on('pageerror', e => console.log('E', e.message));
  await pg.goto('http://localhost:8766/iconsrc/render.html'); await pg.waitForFunction(() => window.ready);
  const done = new Set();
  for (const [e, [key, spec]] of Object.entries(map)) {
    if (!spec || done.has(key)) continue; done.add(key);
    try {
      const u = await pg.evaluate(async ([spec]) => {
        if (spec.startsWith('proc:')) { const [n, a] = spec.slice(5).split('|'); return window.renderProc(n, a != null ? [isNaN(+a) ? a : +a] : [], {}); }
        if (spec.startsWith('HEX:')) return window.renderIcon('/iconsrc/hex/' + spec.slice(4), {});
        if (spec.startsWith('REST:')) return window.renderIcon('/iconsrc/rest/' + spec.slice(5), {});
        if (spec.startsWith('CHAR:')) return window.renderProc('character', [spec.slice(5)], { zoom: 0.5, el: 0.2 });
      }, [spec]);
      fs.writeFileSync(`/home/user/capital-game/assets/icons/${key}.png`, Buffer.from(u.split(',')[1], 'base64')); process.stdout.write('.');
    } catch (err) { console.log('\nFAIL', key, err.message.split('\n')[0]); }
  }
  console.log(' done', done.size); await b.close();
})();
