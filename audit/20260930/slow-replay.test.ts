import {afterEach,describe,expect,it,vi} from 'vitest';
vi.mock('../utils/withPersist',()=>({withPersist:(s:any)=>s}));
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()});
describe('audit: actual slow-replay timing',()=>{
 it('an old timer restores an obsolete playback preference after user changes speed',async()=>{
 vi.useFakeTimers();vi.stubGlobal('window',{navigator:{language:'en'},setTimeout});vi.stubGlobal('document',{body:{classList:{toggle(){}}}});
 const v=await import('../models/videos'),s=await import('../models/settings');await import('../models/videos/init');const video:any={currentTime:0,playbackRate:1,play:async()=>{},pause(){}};v.getCurrentVideoFx.use(async()=>video);await v.getCurrentVideoFx();s.playbackRateChanged(1);
 await v.slowReplayFx({video,currentSubs:[{id:0,start:0,end:4000}] as any,streaming:{name:'test'} as any,userRate:1});expect(video.playbackRate).toBe(0.75);await vi.advanceTimersByTimeAsync(1000);s.playbackRateChanged(1.5);expect(video.playbackRate).toBe(1.5);await vi.advanceTimersByTimeAsync(5000);expect(s.$playbackRate.getState()).toBe(1.5);expect(video.playbackRate).toBe(1);console.log('Selected preference:',s.$playbackRate.getState(),'actual player after old timer:',video.playbackRate);
 });
 it('the first slow-replay timer cuts short a later slow replay',async()=>{
 const v=await import('../models/videos');vi.useFakeTimers();vi.stubGlobal('window',{navigator:{language:'en'},setTimeout});const video:any={currentTime:0,playbackRate:1,play:async()=>{},pause(){}};const input:any={video,currentSubs:[{id:0,start:0,end:4000}],streaming:{name:'test'},userRate:1};await v.slowReplayFx(input);await vi.advanceTimersByTimeAsync(2000);await v.slowReplayFx(input);expect(video.playbackRate).toBe(0.75);await vi.advanceTimersByTimeAsync(3414);expect(video.playbackRate).toBe(1);console.log('Second replay rate at 3414ms (before its 5333ms duration):',video.playbackRate);
 });
});
