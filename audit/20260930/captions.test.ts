import {describe,expect,it,vi} from 'vitest';
vi.mock('../utils/withPersist',()=>({withPersist:(store:any)=>store}));
vi.mock('../pages/content/notify',()=>({notifyError:vi.fn(),notifyInfo:vi.fn()}));
function pending(){let resolve!:(v:any)=>void;return {promise:new Promise<any>(r=>resolve=r),resolve:(v:any)=>resolve(v)}}
const captions=(text:string)=>[{text,start:0,end:1000}];
describe('audit: actual caption fetch boundaries',()=>{
 it('an old primary request overwrites newer captions and can repopulate after reset',async()=>{
 vi.stubGlobal('document',{body:{classList:{toggle(){}}}});vi.stubGlobal('window',{navigator:{language:'en'}});vi.stubGlobal('chrome',{runtime:{sendMessage:async()=>({ok:true,data:{available:false}})}});
 const model=await import('../models/subs');await import('../models/subs/init');
 model.processJapaneseSubsFx.use(async()=>[]);model.processRawSubsFx.use(async()=>[]);
 const old=pending(),fresh=pending();const service=(p:any)=>({name:'test',getSubs:async()=>p.promise});
 const a=model.fetchSubsFx({streaming:service(old) as any,language:'ja'}),b=model.fetchSubsFx({streaming:service(fresh) as any,language:'ja'});fresh.resolve(captions('New video'));await b;expect(model.$rawSubs.getState()[0].text).toBe('New video');old.resolve(captions('Old video'));await a;expect(model.$rawSubs.getState()[0].text).toBe('Old video');console.log('After newer then older response:',model.$rawSubs.getState());
 const late=pending(),c=model.fetchSubsFx({streaming:service(late) as any,language:'ja'});model.resetSubs('');expect(model.$rawSubs.getState()).toEqual([]);late.resolve(captions('Disabled old video'));await c;expect(model.$rawSubs.getState()[0].text).toBe('Disabled old video');console.log('After reset then late fetch:',model.$rawSubs.getState());vi.unstubAllGlobals();
 });
});
