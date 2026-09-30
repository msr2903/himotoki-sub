import {afterEach,expect,it,vi} from 'vitest';
vi.mock('../utils/withPersist',()=>({withPersist:(s:any)=>s}));
afterEach(()=>vi.unstubAllGlobals());
it('turning Enabled off still allows keyboard speed changes and claims player keys',async()=>{
 vi.stubGlobal('window',{navigator:{language:'en'}});const toggle=vi.fn();vi.stubGlobal('document',{body:{classList:{toggle}}});
 const settings=await import('../models/settings');const {keyboardHandler}=await import('./keyboardHandler');await settings.enableToggleChangeFx(false);
 expect(settings.$enabled.getState()).toBe(false);expect(toggle).toHaveBeenLastCalledWith('es-enabled',false);
 const before=settings.$playbackRate.getState();const event:any={code:'Period',type:'keydown',target:{closest:()=>null},preventDefault:vi.fn(),stopPropagation:vi.fn()};keyboardHandler(event);
 expect(settings.$playbackRate.getState()).toBeGreaterThan(before);expect(event.preventDefault).toHaveBeenCalled();console.log('Enabled=',settings.$enabled.getState(),'; . shortcut still claims key and changes rate from',before,'to',settings.$playbackRate.getState());
});
it('disabled extension still captures an assigned mouse action over the player',async()=>{
 vi.stubGlobal('window',{navigator:{language:'en'}});const listeners:Record<string,any>={};vi.stubGlobal('document',{body:{classList:{toggle(){}}},addEventListener:(k:string,v:any)=>listeners[k]=v,removeEventListener(){}});
 const s=await import('../models/settings'),v=await import('../models/videos'),stream=await import('../models/streamings');const m=await import('./mouseHandler');await s.enableToggleChangeFx(false);s.mouseActionChanged({button:'middle',action:'playPause'});stream.streamingDetected({name:'test',isOnFlight:()=>false} as any);const video:any={paused:false,pause:vi.fn(),getBoundingClientRect:()=>({left:0,top:0,right:100,bottom:100})};v.getCurrentVideoFx.use(async()=>video);await v.getCurrentVideoFx();m.addMouseEventsListeners();
 const event:any={button:1,clientX:50,clientY:50,target:{closest:()=>null},preventDefault:vi.fn(),stopPropagation:vi.fn()};listeners.mousedown(event);
 expect(s.$enabled.getState()).toBe(false);expect(video.pause).toHaveBeenCalled();expect(event.preventDefault).toHaveBeenCalled();console.log('Enabled=false; assigned middle-click still pauses player and suppresses browser action.');m.removeMouseEventsListeners();
});
