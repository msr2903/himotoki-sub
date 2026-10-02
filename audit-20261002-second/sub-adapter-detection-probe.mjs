import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const require=createRequire(path.join(process.cwd(),'package.json'));
const {build}=createRequire(require.resolve('vite'))('esbuild');
async function load(entry,detector=false){
 const result=await build({entryPoints:[entry],bundle:true,write:false,format:'cjs',platform:'node',alias:{'@src':path.join(process.cwd(),'src')},plugins:[{name:'browser-boundaries',setup(b){
 b.onResolve({filter:detector?/^@src\/streamings\//:/^@src\/models\//},a=>({path:a.path,namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:detector?`export default class {name=${JSON.stringify(a.path.split('/').at(-1).replace('serviceStub','stub'))}}`:'export const esSubsChanged=()=>{},esRenderSetings=()=>{};',loader:'js'}));
 }}]});
 const sandbox={module:{exports:{}},exports:{},console,URL,document:globalThis.document,window:globalThis.window};sandbox.exports=sandbox.module.exports;vm.runInNewContext(result.outputFiles[0].text,sandbox);return sandbox.module.exports;
}
globalThis.document={querySelector:s=>s==='title'?{textContent:''}:null,body:{classList:{contains:()=>false,add:()=>{}}}};
globalThis.window={location:{host:''}};
const detector=await load('src/utils/getCurrentService.ts',true);
for(const host of ['app.plex.tv','www.udemy.com','hd.kinopoisk.ru','www.primevideo.com','www.youtube.com','www.coursera.org']){
 window.location.host=host;const name=detector.getCurrentService().name;
 assert.equal(name,['www.youtube.com','www.coursera.org'].includes(host)?(host.includes('youtube')?'youtube':'coursera'):'stub');
 console.log(JSON.stringify({case:'advertised-site detection',host,selectedAdapter:name}));
}
const player={id:'vidstack-player'};
globalThis.document={querySelector:s=>s==='media-player'?player:s==='.control-button.btn-settings'?{id:'settings-button'}:null};
const KinoPub=(await load('src/streamings/kinopub.ts')).default;
const kino=new KinoPub();assert.equal(kino.getSubsContainer(),player);assert.ok(kino.getSettingsButtonContainer());
let error;try{kino.getSettingsContentContainer()}catch(e){error=e.message}
assert.equal(error,'Settings content container not found');
console.log(JSON.stringify({case:'Vidstack container supported for subtitles but rejected for settings',subtitleContainerFound:true,settingsButtonFound:true,settingsContentError:error}));
