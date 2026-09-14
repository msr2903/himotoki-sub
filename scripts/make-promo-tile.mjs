// Renders the Chrome Web Store promo tile (440×280) from a small HTML template.
// Usage: node scripts/make-promo-tile.mjs  → store/promo-440x280.png
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../store/promo-440x280.png");
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:440px;height:280px;background:#141413;color:#e8e6e1;font-family:"Zen Maru Gothic","Hiragino Sans","Noto Sans JP",system-ui,sans-serif;overflow:hidden}
  .bg{position:absolute;inset:0;background:radial-gradient(ellipse 120% 80% at 50% -20%,rgba(61,190,176,.18),transparent)}
  .wrap{position:relative;padding:34px 36px}
  .brand{font-family:"Newsreader",Georgia,serif;font-size:40px;font-weight:600;letter-spacing:-.02em;line-height:1}
  .brand span{font-family:inherit;font-size:16px;color:#a3a09a;margin-left:10px;letter-spacing:0}
  .line{margin-top:26px;font-size:26px;line-height:1.35}
  .tok{display:inline-block;position:relative;padding:0 2px}
  .tok.hi{color:#3dbeb0;background:rgba(61,190,176,.14);border-radius:3px}
  .furi{position:absolute;left:50%;top:-16px;transform:translateX(-50%);font-size:11px;color:#3dbeb0;white-space:nowrap}
  .tag{margin-top:26px;font-size:13px;color:#a3a09a}
</style></head><body><div class="bg"></div><div class="wrap">
  <div class="brand">Himotoki<span>Sub</span></div>
  <div class="line"><span class="tok">毎日</span><span class="tok">必ず</span><span class="tok hi"><span class="furi">のみます · to drink</span>飲みます</span><span class="tok">。</span></div>
  <div class="tag">Japanese subtitles, split into words · offline dictionary · furigana · Anki</div>
</div></body></html>`;

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 440, height: 280 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.waitForTimeout(300);
await page.screenshot({ path: out });
await browser.close();
console.log("wrote", out);
