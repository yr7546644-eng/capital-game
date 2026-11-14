const { chromium } = require('playwright'); const fs = require('fs');
const B = '/iconsrc/hex/buildings/', P = '/iconsrc/hex/decoration/props/', RS = '/iconsrc/rest/';
const L = {
  b_bread: [B + 'blue/building_windmill_blue.gltf'], b_potion: [B + 'blue/building_church_blue.gltf'], b_tool: [B + 'blue/building_blacksmith_blue.gltf'], b_cloth: [B + 'blue/building_market_blue.gltf'], b_work: [B + 'blue/building_watermill_blue.gltf'],
  wheat: ['proc:wheat'], flour: [P + 'sack.gltf'], herb: [RS + 'crate_lettuce.gltf'], tincture: ['proc:bottle', { args: [0x4fd18b] }], iron: ['proc:ingots', { args: [0x58606b, 0.5] }], steel: ['proc:ingots', { args: [0x7fa6cf, 0.9] }], wool: ['proc:wool'], fabric: ['proc:fabric'],
  starsilver: ['proc:ingots', { args: [0xdfe8ff, 1, 0x7fb0ff] }], dragonscale: ['proc:scales'], moonherb: [RS + 'crate_lettuce.gltf', { tint: '#b49cff', tk: 0.7, emi: 0.2 }], seapearl: ['proc:pearl'], goldwheat: ['proc:wheat', { args: [1] }],
  ui_build: [B + 'neutral/building_scaffolding.gltf'], ui_market: [P + 'crate_open.gltf'], ui_books: ['proc:book'], ui_town: [B + 'blue/building_castle_blue.gltf'], ui_crate: [P + 'crate_open.gltf'],
  g_bread: [RS + 'food_ingredient_bun.gltf'], coin: ['proc:coin'], g_potion: ['proc:bottle', { args: [0xe0485e] }], g_tool: ['proc:hammer'], g_cloth: ['proc:fabric', { args: [0x3a7bd5, 0xc0395b] }],
};
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage(); pg.on('pageerror', e => console.log('E', e.message)); pg.on('console', m => { if (m.type() === 'error') console.log('C', m.text()); });
  await pg.goto('http://localhost:8766/iconsrc/render.html'); await pg.waitForFunction(() => window.ready);
  for (const [k, [path, opt]] of Object.entries(L)) {
    try { const u = await pg.evaluate(([p, o]) => p.startsWith('proc:') ? window.renderProc(p.slice(5), (o || {}).args || [], o || {}) : window.renderIcon(p, o || {}), [path, opt]); fs.writeFileSync(`/home/user/capital-game/assets/icons/${k}.png`, Buffer.from(u.split(',')[1], 'base64')); process.stdout.write(k + ' '); } catch (e) { console.log('\nFAIL', k, e.message.split('\n')[0]); }
  }
  console.log(); await b.close();
})();
