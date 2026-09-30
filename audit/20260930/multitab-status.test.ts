import {afterEach,describe,expect,it,vi} from 'vitest';
afterEach(()=>vi.unstubAllGlobals());
describe('audit: cross-tab word status persistence',()=>{
 it('two tabs marking different words before onChanged delivery lose the first word',async()=>{
 const data:Record<string,string>={};const notifications:any[]=[];const listeners:any[]=[];
 vi.stubGlobal('window',{navigator:{language:'en'}});vi.stubGlobal('document',{body:{classList:{toggle(){}}}});
 vi.stubGlobal('chrome',{storage:{local:{get:(keys:string[],cb:any)=>queueMicrotask(()=>cb(Object.fromEntries(keys.filter(k=>k in data).map(k=>[k,data[k]])))),set:(obj:any)=>{const changes:any={};for(const [k,v]of Object.entries(obj)){changes[k]={oldValue:data[k],newValue:v};data[k]=v as string;}notifications.push(changes);}},onChanged:{addListener:(l:any)=>listeners.push(l)}}});
 const a=await import('../models/settings');vi.resetModules();const b=await import('../models/settings');await new Promise(r=>setTimeout(r,0));
 const cat='seq:jitendex:1467640',dog='seq:jitendex:1259970';
 a.wordStatusSet({key:cat,status:'known'});b.wordStatusSet({key:dog,status:'known'});
 expect(a.$wordStatuses.getState()).toEqual({[cat]:'known'});expect(b.$wordStatuses.getState()).toEqual({[dog]:'known'});
 while(notifications.length){const change=notifications.shift();for(const l of listeners)l(change,'local');}
 expect(JSON.parse(data['persist:wordStatuses'])).toEqual({[dog]:'known'});
 expect(a.$wordStatuses.getState()).toEqual({[dog]:'known'});expect(b.$wordStatuses.getState()).toEqual({[dog]:'known'});
 expect(JSON.parse(data['persist:knownWords'])).toEqual([dog]);
 console.log('Tab A marked cat; tab B marked dog. After notifications, stored statuses:',data['persist:wordStatuses'],'known words:',data['persist:knownWords']);
 });
});
