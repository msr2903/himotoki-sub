import {describe,expect,it,vi} from 'vitest';
vi.mock('webext-dynamic-content-scripts',()=>({}));
describe('audit: real background without Chrome offscreen (Firefox)',()=>{
 it('all dictionary routes fail, and lookups perform no online fallback',async()=>{
 let listener:any;vi.stubGlobal('self',{clients:{matchAll:async()=>[]}});vi.stubGlobal('chrome',{runtime:{getURL:(p:string)=>`moz-extension://audit/${p}`,getContexts:undefined,onInstalled:{addListener(){}},OnInstalledReason:{INSTALL:'install'},onMessage:{addListener(fn:any){listener=fn}},sendMessage:vi.fn()},storage:{local:{get:async()=>({})}},identity:{getRedirectURL:()=>''},tabs:{create(){}}});const network=vi.fn();vi.stubGlobal('fetch',network);
 await import('../pages/background/index');
 for(const type of ['himotokiDictStatus','himotokiLookup','himotokiDictInstall']){const response=await new Promise<any>(resolve=>{expect(listener({type,surface:'猫'},null,resolve)).toBe(true)});expect(response.ok).toBe(false);expect(response.error).toMatch(/createDocument/);console.log(type,JSON.stringify(response));}
 // Install tries to read the release manifest; neither status nor lookup calls HTTP.
 expect(network.mock.calls.every(([u]:any)=>String(u).includes('.json'))).toBe(true);
 vi.unstubAllGlobals();
 });
});
