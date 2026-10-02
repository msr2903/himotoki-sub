// Run with Node from an isolated Himotoki Sub checkout with dependencies installed.
// Imports the actual ProgressBar component; browser/React hooks are controlled doubles.
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const require = createRequire(path.join(process.cwd(),'package.json'));
const { build } = createRequire(require.resolve('vite'))('esbuild');
const built=await build({entryPoints:['src/pages/content/components/ProgressBar/ProgressBar.tsx'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'hooks',setup(b){
 b.onResolve({filter:/^(react|effector-react|@src\/models\/)/},a=>({path:a.path,namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:a.path==='react/jsx-runtime'?'export const jsx=(type,props)=>({type,props}); export const jsxs=jsx;':a.path==='react'?'export const useEffect=globalThis.H.useEffect, useRef=globalThis.H.useRef, useState=globalThis.H.useState;':a.path==='effector-react'?'export const useUnit=()=>[globalThis.H.video,globalThis.H.subs];':'export const $video={}, $subs={}; export const moveToTimeRequested=(t)=>globalThis.H.seeks.push(t);',loader:'js'}));
}}],alias:{'@src':path.join(process.cwd(),'src')}});
function run(subs,frames=1){
 const H={video:{currentTime:30,paused:true},subs,seeks:[],writes:[],effects:[],raf:[],refs:0};
 const container={clientWidth:1000,parentElement:{clientWidth:1000},getBoundingClientRect:()=>({left:100})};
 H.useRef=(initial)=>({current:H.refs++===0?container:initial});
 H.useState=initial=>[initial,v=>H.writes.push(v)]; H.useEffect=f=>H.effects.push(f);
 const sandbox={H,exports:{},module:{exports:{}},console,requestAnimationFrame:f=>{H.raf.push(f);return H.raf.length},cancelAnimationFrame:()=>{}};
 sandbox.exports=sandbox.module.exports;vm.runInNewContext(built.outputFiles[0].text,sandbox);
 const tree=sandbox.module.exports.ProgressBar();H.effects.forEach(f=>f());
 for(let i=0;i<frames;i++) H.raf.shift()?.();
 return {H,tree};
}
const long=run([{start:0,end:60000,text:'長い説明'}]);
assert.equal(long.H.writes.at(-1).length,0);
console.log(JSON.stringify({case:'cue spans entire visible window',cue:[0,60000],window:[15000,45000],renderedMarkers:0}));
const click=run([{start:25000,end:27000,text:'猫'}]);
click.tree.props.onClick({nativeEvent:{offsetX:20,clientX:100+1000/30000*10000+20}});
assert.equal(click.H.seeks[0],15600);
console.log(JSON.stringify({case:'click 20px inside a cue marker starting 333px into container',actualSeekMs:click.H.seeks[0],expectedSeekMs:25600}));
let visits=0;const many=Array.from({length:10000},(_,i)=>({start:i*3000,end:i*3000+2000,text:'猫'}));
const nativeFilter=many.filter.bind(many);many.filter=f=>nativeFilter((x,i)=>{visits++;return f(x,i)});
const paused=run(many,60);
assert.equal(visits,600000);assert.equal(paused.H.writes.length,60);
console.log(JSON.stringify({case:'paused video over 60 animation callbacks',cueCount:10000,fullTranscriptRowVisits:visits,ReactStateWrites:paused.H.writes.length}));
