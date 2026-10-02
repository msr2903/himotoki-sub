// Run from the pinned Sub checkout with dependencies installed. Actual source is bundled;
// React, model boundaries, player DOM and file reads are controlled doubles, not a browser capture.
import {createRequire} from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const req=createRequire(path.join(process.cwd(),'package.json'));
const {build}=createRequire(req.resolve('vite'))('esbuild');
async function load(entry,H,mode){
 const result=await build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'cjs',alias:{'@src':path.join(process.cwd(),'src')},plugins:[{name:'boundaries',setup(b){
  b.onResolve({filter:/^(react(?:\/|$)|react-dom\/|effector-react$|@src\/models\/|virtual:|@src\/pages\/content\/components\/|@src\/utils\/(?:keyboardHandler|mouseHandler|getCurrentService)$)/},a=>({path:a.path,namespace:'fake'}));
  b.onResolve({filter:/^\.\/components\//},a=>({path:a.path,namespace:'fake'}));
  b.onLoad({filter:/.*/,namespace:'fake'},a=>{
   const p=a.path;
   const text=p==='react/jsx-runtime'?'export const jsx=(type,props)=>({type,props}),jsxs=jsx;':p==='effector-react'?'export const useUnit=()=>[H.replace];':p==='react-dom/client'?'export const createRoot=()=>({render(){},unmount(){}});':p==='@src/models/streamings'?'export const $streaming=H.streaming,streamingDetected=()=>{};':p==='@src/models/videos'?'export const $video=H.videoStore,getCurrentVideoFx=()=>{},videoTimeUpdate=()=>H.ticks++;':p==='@src/models/settings'?'export const esRenderSetings=H.renderSettings;':p==='@src/models/subs'?'export const esSubsChanged=H.subsChanged,ES_CUSTOM_SUB_LABEL="custom",updateCustomSubsFx={};':p.includes('getCurrentService')?'export const getCurrentService=()=>H.service;':p.includes('keyboardHandler')?'export const removeKeyboardEventsListeners=()=>{};':p.includes('mouseHandler')?'export const removeMouseEventsListeners=()=>{};':p.startsWith('virtual:')?'export default ()=>{};':'export const Settings=()=>null,Subs=()=>null,ProgressBar=()=>null;';
   return {contents:text,loader:'js'};
  });
 }}]});
 const sandbox={H,module:{exports:{}},exports:{},console:{log(){},warn(){},error(){}},document:H.document,window:H.window,chrome:H.chrome,FileReader:H.FileReader,fetch:H.fetch};
 sandbox.exports=sandbox.module.exports;vm.runInNewContext(result.outputFiles[0].text,sandbox);return sandbox.module.exports;
}
function event(){let listeners=[];const e=(v)=>listeners.forEach(f=>f(v));e.watch=f=>listeners.push(f);return e;}
function video(){const handlers=new Set();return {addEventListener:(t,f)=>handlers.add(f),removeEventListener:(t,f)=>handlers.delete(f),fire:()=>handlers.forEach(f=>f()),handlers};}
const old=video(),next=video();let active=old;const watch=[];
const H={ticks:0,service:{name:'youtube',init(){},getSettingsButtonContainer:()=>({parentNode:{insertBefore(){}}}),getSettingsContentContainer:()=>({})},videoStore:{watch(f){watch.push(f);f(active)}},renderSettings:event(),subsChanged:event(),document:{body:{classList:{add(){}}},querySelectorAll:()=>[],createElement:()=>({})}};
H.streaming={getState:()=>H.service,watch:f=>f(H.service)};
await load('src/pages/content/main.tsx',H);
H.renderSettings();assert.equal(old.handlers.size,1);
active=next;watch.forEach(f=>f(next));
old.fire();assert.equal(H.ticks,1);assert.equal(old.handlers.size,1);
console.log(JSON.stringify({case:'video replacement leaves old timeupdate listener',oldListeners:old.handlers.size,newListeners:next.handlers.size,obsoleteVideoEmittedClockTicks:H.ticks}));

const uploads={subsChanged:event(),readers:[],replace(cues){uploads.track=cues;},FileReader:class {constructor(){uploads.readers.push(this)} readAsText(file){this.result=file.text;this.onload();}}};
const CustomSubs=(await load('src/pages/content/components/Settings/CustomSubs.tsx',uploads)).CustomSubs;
const tree=CustomSubs();const input=tree.props.children[1].props.children[0];
input.props.onChange({target:{files:[{text:'1\n00:00:01,000 --> 00:00:03,000\n猫です\n'}]}});
assert.equal(uploads.track.length,1);
input.props.onChange({target:{files:[{text:''}]}});
assert.equal(uploads.track.length,0);
console.log(JSON.stringify({case:'empty subtitle file replaces a valid track',validCueCount:1,afterEmptyFileCueCount:uploads.track.length,notificationCalls:0}));
input.props.onChange({target:{files:[{text:'This is a README, not subtitles.'}]}});
assert.equal(uploads.track.length,1);assert.equal(uploads.track[0].start,undefined);
console.log(JSON.stringify({case:'non-subtitle text accepted without valid timestamps',acceptedCueCount:uploads.track.length,validTimedCues:uploads.track.filter(c=>Number.isFinite(c.start)&&Number.isFinite(c.end)).length}));

// Inoriginal metadata-order candidate was excluded: its actual page script emits
// config before id. Artificial reverse ordering alone does not establish a reachable defect.
