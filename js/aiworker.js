// ライバルAIの思考を画面とは別のスレッドで行う(深読みしても操作が固まらないように)
import * as E from './engine.js';
self.onmessage = ({ data }) => {
  try {
    const S = data.S; E.useStage(S.stage);
    const dec = {};
    for (const p of S.players) if (p.ai) dec[p.id] = E.aiDecide(S, p.id);
    self.postMessage({ ok: 1, dec, rs: S.rs, id: data.id });
  } catch (e) { self.postMessage({ ok: 0, err: String(e && e.message || e), id: data.id }); }
};
