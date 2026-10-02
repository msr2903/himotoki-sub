import {createRequire} from 'node:module';import path from 'node:path';import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
const require=createRequire(path.join(process.cwd(),'package.json'));const {build}=createRequire(require.resolve('vite'))('esbuild');
const out=process.env.AUDIT_OUT??'/tmp/himotoki-audit200-caption-markup';mkdirSync(out,{recursive:true});
const code=readFileSync('src/utils/convertRawSubs.ts','utf8');
const r=await build({stdin:{contents:code+'\nwindow.auditConvertJapaneseSubsFallback=convertJapaneseSubsFallback;',resolveDir:path.join(process.cwd(),'src/utils'),loader:'ts'},bundle:true,format:'iife',platform:'browser',write:false,alias:{'@src':path.join(process.cwd(),'src')}});
writeFileSync(path.join(out,'probe.js'),r.outputFiles[0].text);
copyFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'sub-caption-markup.html'),path.join(out,'index.html'));
console.log('Built actual convertJapaneseSubsFallback. Serve '+out+' over loopback HTTP and inspect window.auditResult.');
