import {describe,expect,it,vi} from 'vitest';
vi.mock('../models/settings',async()=>{const {createStore}=await import('effector');return {$translateLanguage:createStore('en'),$translationService:createStore('google'),$deeplApiKey:createStore('')}});
vi.mock('../models/subs',async()=>{const {createStore}=await import('effector');return {$currentSubs:createStore([]),$subs:createStore([])}});
import {fork,scopeBind,allSettled} from 'effector';
import {$lookups,$dictReady,lookupRequested,checkDictReadyFx,fetchWordTranslationFx} from '../models/translations';
it('ready-to-ready dictionary replacement retains the previous cached entry',async()=>{
 let current='old revision';let calls=0;
 const scope=fork({handlers:[[checkDictReadyFx,async()=>true],[fetchWordTranslationFx,async({source})=>{calls++;return {source,mainTranslation:current,lookupSource:'local',targetLanguage:'en',translations:[],transcription:''} as any}]]});
 await allSettled(checkDictReadyFx,{scope});await allSettled(lookupRequested,{scope,params:'猫'});expect(scope.getState($lookups).猫.mainTranslation).toBe('old revision');
 current='new revision';await allSettled(checkDictReadyFx,{scope});expect(scope.getState($dictReady)).toBe(true);await allSettled(lookupRequested,{scope,params:'猫'});
 expect(calls).toBe(1);expect(scope.getState($lookups).猫.mainTranslation).toBe('old revision');console.log('After new dictionary reports ready: calls=',calls,'cached meaning=',scope.getState($lookups).猫.mainTranslation);
});
