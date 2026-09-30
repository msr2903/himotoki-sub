import {expect,it,vi} from 'vitest';
vi.mock('../models/settings',async()=>{const {createStore}=await import('effector');return {$translateLanguage:createStore('ja'),$translationService:createStore('google'),$deeplApiKey:createStore('')}});
vi.mock('../models/subs',async()=>{const {createStore}=await import('effector');return {$currentSubs:createStore([]),$subs:createStore([])}});
import {fork,allSettled} from 'effector';import {fetchWordTranslationFx,fetchSubTranslationFx,lookupRequested,lineTranslationRequested,$lookups,$lineTranslations} from '../models/translations';
it('ordinary object inherited keys suppress valid word/line requests before any cache entry exists',async()=>{
 const word=vi.fn(async({source})=>({source,mainTranslation:'test',lookupSource:'local',targetLanguage:'en',translations:[],transcription:''} as any));const line=vi.fn(async()=> '翻訳');const scope=fork({handlers:[[fetchWordTranslationFx,word],[fetchSubTranslationFx,line]]});
 for(const text of ['constructor','toString','__proto__']){await allSettled(lookupRequested,{scope,params:text});await allSettled(lineTranslationRequested,{scope,params:text});expect(Object.hasOwn(scope.getState($lookups),text)).toBe(false);expect(Object.hasOwn(scope.getState($lineTranslations),text)).toBe(false)}
 expect(word).not.toHaveBeenCalled();expect(line).not.toHaveBeenCalled();console.log('constructor / toString / __proto__: word calls=',word.mock.calls.length,'line calls=',line.mock.calls.length,'despite empty caches');
 await allSettled(lookupRequested,{scope,params:'猫'});await allSettled(lineTranslationRequested,{scope,params:'猫'});expect(word).toHaveBeenCalledTimes(1);expect(line).toHaveBeenCalledTimes(1);
});
