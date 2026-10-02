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

for (const title of ['Welcome | Coursera','Twitter, LinkedIn, and YouTube Marketing | Coursera']) {
 window.location.host='www.coursera.org'; document.querySelector=s=>s==='title'?{textContent:title}:null;
 const selected=detector.getCurrentService().name;
 assert.equal(selected,title.includes('YouTube')?'youtube':'coursera');
 console.log(JSON.stringify({case:'host vs topic title',host:window.location.host,title,selectedAdapter:selected}));
}
