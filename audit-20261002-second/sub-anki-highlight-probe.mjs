// Run from the pinned Sub checkout. Bundle the real service and note builder;
// AnkiConnect is replaced by deterministic valid responses, not a running Anki instance.
import {createRequire} from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const req=createRequire(path.join(process.cwd(),'package.json'));
const {build}=createRequire(req.resolve('vite'))('esbuild');
const result=await build({entryPoints:['src/learning-service/anki.ts'],bundle:true,write:false,format:'cjs',platform:'node',alias:{'@src':path.join(process.cwd(),'src')}});
let note;
const sandbox={module:{exports:{}},exports:{},chrome:{runtime:{sendMessage:async({data})=>{
 if(data.action==='modelNames')return {result:['Himotoki'],error:null};
 if(data.action==='addNote'){note=data.params.note;return {result:1,error:null};}
 return {result:true,error:null};
}}}};
sandbox.exports=sandbox.module.exports;vm.runInNewContext(result.outputFiles[0].text,sandbox);
const anki=new sandbox.module.exports.Anki();
await anki.addWord('食べた','ate',{richCards:true,contextSentence:'朝ご飯を食べた。',himotokiSave:{headword:'食べる',reading:'たべる'}});
assert.equal(note.fields.Word,'食べる');assert.equal(note.fields.Sentence,'朝ご飯を食べた。');
console.log(JSON.stringify({case:'conjugated mined surface is not highlighted',surface:'食べた',headword:note.fields.Word,sentenceField:note.fields.Sentence,containsHighlight:note.fields.Sentence.includes('<b>')}));
await anki.addWord('食べる','eat',{richCards:true,contextSentence:'朝ご飯を食べる。',himotokiSave:{headword:'食べる',reading:'たべる'}});
assert.equal(note.fields.Sentence,'朝ご飯を<b>食べる</b>。');
console.log(JSON.stringify({case:'unconjugated control',sentenceField:note.fields.Sentence,containsHighlight:true}));
