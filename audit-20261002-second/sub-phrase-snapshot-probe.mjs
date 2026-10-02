// Run from pinned Sub with installed dependencies. AUDIT_APP_DIR names an app
// checkout containing jsdom. Uses actual React 18 and the unchanged PhraseBar,
// exposing that private component by adding an export only. Translation and
// learning-service boundaries are controlled; no browser, account or Anki writes.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const req=createRequire(path.join(process.cwd(),'package.json'));
const appReq=createRequire(path.join(process.env.AUDIT_APP_DIR||path.resolve('../app'),'packages/web/package.json'));
const {JSDOM}=appReq('jsdom');
const dom=new JSDOM('<div id="root"></div>',{url:'https://fixture.invalid'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
const React=req('react'),{createRoot}=req('react-dom/client'),{act}=req('react-dom/test-utils');
const {build}=createRequire(req.resolve('vite'))('esbuild');
const source=fs.readFileSync('src/pages/content/components/Subs/Subs.tsx','utf8');
const exportsByPath=new Map();
for(const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/gs)){
 exportsByPath.set(match[2],[...new Set([...(exportsByPath.get(match[2])||[]),...match[1].split(',').map(x=>x.trim()).filter(x=>/^[$\w]+$/.test(x))])]);
}
const result=await build({stdin:{contents:source+'\nexport {PhraseBar as AuditPhraseBar};',resolveDir:path.resolve('src/pages/content/components/Subs'),sourcefile:'Subs.tsx',loader:'tsx'},bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',external:['react','react/jsx-runtime'],plugins:[{name:'boundaries',setup(b){
 b.onResolve({filter:/.*/},a=>a.path==='react'||a.path==='react/jsx-runtime'?{path:a.path,external:true}:{path:a.path,namespace:'fake'});
 b.onLoad({filter:/.*/,namespace:'fake'},a=>{
  let contents;
  if(a.path==='effector-react')contents='export const useUnit=()=>H.config;';
  else if(a.path==='react-hot-toast')contents='export default H.toast;';
  else if(a.path==='react-draggable'||a.path==='classnames')contents='export default ()=>null;';
  else contents=(exportsByPath.get(a.path)||[]).map(name=>`export const ${name}=H[${JSON.stringify(name)}]||{};`).join('\n');
  return {contents,loader:'js'};
 });
}}]});
const H={config:['anki','Fixture','fixture','auto',false],saves:[],responses:{},toast:{success(){},error(){}},parseAnkiTags:s=>[s],getLearningService:()=>({addWord:(...args)=>{H.saves.push(args);return Promise.resolve('saved');}}),useLineTranslation:text=>text?(H.responses[text]||{translation:null,error:null,pending:true}):{translation:null,error:null,pending:false}};
const sandbox={H,module:{exports:{}},exports:{},require:req,console,window,document};sandbox.exports=sandbox.module.exports;vm.runInNewContext(result.outputFiles[0].text,sandbox);
const Phrase=sandbox.module.exports.AuditPhraseBar,root=createRoot(document.querySelector('#root'));
const render=phrase=>root.render(React.createElement(Phrase,{phrase,contextSentence:'猫が好きです。',onClose(){}}));
try{
 await act(async()=>render('猫が'));
 await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Save phrase').dispatchEvent(new window.MouseEvent('click',{bubbles:true})));
 assert.equal(H.saves.length,0);
 H.responses['猫が好き']={translation:'like cats',error:null,pending:false};
 await act(async()=>render('猫が好き'));
 assert.equal(H.saves.length,1);assert.equal(H.saves[0][0],'猫が好き');
 console.log(JSON.stringify({case:'changing selection while Save phrase waits on translation saves the replacement phrase',clickedSaveFor:'猫が',selectionAfterClick:'猫が好き',savedPhrase:H.saves[0][0],saveClicks:1,saveCalls:H.saves.length}));
}finally{await act(async()=>root.unmount());dom.window.close();}
