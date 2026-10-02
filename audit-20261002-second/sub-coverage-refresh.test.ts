import {it,expect,vi} from 'vitest';
import {allSettled,fork} from 'effector';
vi.mock('patronum',()=>({debug:()=>{}}));
vi.mock('@src/pages/content/notify',()=>({notifyInfo:()=>{},notifyError:()=>{}}));
vi.mock('./models/settings',async()=>{const {createStore}=await import('effector');return {
 $autoPause:createStore(false),$secondarySubs:createStore('off'),$translateLanguage:createStore('en'),
 $translationService:createStore('google'),$deeplApiKey:createStore(''),$knownWords:createStore([]),
}});
vi.mock('./models/streamings',async()=>{const {createStore}=await import('effector');return {$streaming:createStore({name:'stub'})}});
import {$coverageKeys,$coverageStatus,$subs,computeCoverageFx,processJapaneseSubsFx,processRawSubsFx,updateCustomSubsFx} from './models/subs';
import './models/subs/init';
import {$dictReady,checkDictReadyFx,fetchWordTranslationFx} from './models/translations';
import {$videoStats} from './models/stats';

it('install and remove readiness changes never refresh the unchanged captions coverage',async()=>{
 let installed=false;let batches=0;
 const best={source:'jitendex',seq:100,kanji:['猫'],readings:['ねこ'],senses:[{pos:['n'],glosses:['cat']}]};
 const send=vi.fn(async(message:any)=>{
  if(message.type==='himotokiLookupBatch'){
   batches++;return {ok:true,data:{available:installed,results:installed?[{surface:'猫',best}]:[]}};
  }
  if(message.type==='himotokiLookup')return {ok:true,data:{available:installed,surface:'猫',best:installed?best:null}};
  if(message.type==='himotokiDictStatus')return {ok:true,data:{state:installed?'ready':'missing'}};
  throw new Error('unexpected '+message.type);
 });
 vi.stubGlobal('chrome',{runtime:{sendMessage:send}});
 const processed=[{id:0,text:'猫',cleanedText:'猫',start:0,end:1000,items:[{type:'word',text:'猫',cleanedText:'猫'}]}];
 const scope=fork({handlers:[[processRawSubsFx,async()=>processed],[processJapaneseSubsFx,async()=>processed]]});
 try{
  await allSettled(updateCustomSubsFx,{scope,params:[{text:'猫',start:0,end:1000}]});
  expect(scope.getState($coverageStatus)).toBe('missing');
  const beforeInstall=batches;const unchanged=scope.getState($subs);
  installed=true;
  await allSettled(fetchWordTranslationFx,{scope,params:{source:'猫'}});
  expect(scope.getState($dictReady)).toBe(true);
  expect(batches).toBe(beforeInstall);
  expect(scope.getState($coverageStatus)).toBe('missing');
  expect(scope.getState($videoStats)).toBeNull();
  console.log(JSON.stringify({phase:'after installing and a successful real word lookup',dictionaryReady:scope.getState($dictReady),coverageStatus:scope.getState($coverageStatus),stats:scope.getState($videoStats),extraCoverageRequests:batches-beforeInstall,captionIdentityUnchanged:scope.getState($subs)===unchanged}));
  // Control: explicitly rerunning the real coverage effect can recover.
  await allSettled(computeCoverageFx,{scope,params:unchanged});
  expect(scope.getState($coverageStatus)).toBe('ready');
  expect(scope.getState($coverageKeys)['猫']).toBe('seq:jitendex:100');
  const beforeRemoval=batches;
  installed=false;await allSettled(checkDictReadyFx,{scope});
  expect(scope.getState($dictReady)).toBe(false);
  expect(batches).toBe(beforeRemoval);
  expect(scope.getState($coverageStatus)).toBe('ready');
  expect(scope.getState($videoStats)?.total).toBe(1);
  console.log(JSON.stringify({phase:'after removing and a successful status check',dictionaryReady:scope.getState($dictReady),coverageStatus:scope.getState($coverageStatus),stats:scope.getState($videoStats),extraCoverageRequests:batches-beforeRemoval}));
 }finally{vi.unstubAllGlobals()}
});
