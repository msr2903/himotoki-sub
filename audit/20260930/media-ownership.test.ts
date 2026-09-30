import {it,expect,vi,afterEach} from 'vitest';
import {captureCueAudio} from './mediaCapture';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
function environment(){
 vi.useFakeTimers();let stopped=0;
 class Stream{constructor(_:any){}getAudioTracks(){return [{stop:()=>stopped++}];}}
 class Recorder{static isTypeSupported(){return true;}ondataavailable:any;onstop:any;start(){}stop(){this.ondataavailable({data:new Blob(['audio'])});this.onstop();}}
 class Reader{result='data:audio/webm;base64,YXVkaW8=';onloadend:any;readAsDataURL(){this.onloadend();}}
 vi.stubGlobal('MediaStream',Stream);vi.stubGlobal('MediaRecorder',Recorder);vi.stubGlobal('FileReader',Reader);
 const video:any={currentTime:40,paused:true,playbackRate:1.25,captureStream:()=>new Stream([]),play:vi.fn(async()=>{video.paused=false;}),pause:vi.fn(()=>{video.paused=true;})};return {video,stops:()=>stopped};
}
it('audio capture restores obsolete state over a newer seek, play and speed change',async()=>{
 const {video}=environment();const p=captureCueAudio(video,10,12,'test');await vi.advanceTimersByTimeAsync(500);
 video.currentTime=100;video.playbackRate=1.75;await video.play();await vi.advanceTimersByTimeAsync(1500);expect(await p).not.toBeNull();
 expect(video.currentTime).toBe(40);expect(video.playbackRate).toBe(1.25);expect(video.paused).toBe(true);console.log('During capture user sought to 100s, selected 1.75x and played; completion rewound to 40s, restored 1.25x and paused.');
});
it('overlapping captures restore the first capture position and temporary speed after both finish',async()=>{
 const {video}=environment();video.paused=false;const a=captureCueAudio(video,10,12,'first');await vi.advanceTimersByTimeAsync(500);const b=captureCueAudio(video,20,23,'second');await vi.advanceTimersByTimeAsync(3000);expect(await a).not.toBeNull();expect(await b).not.toBeNull();expect(video.currentTime).toBe(10);expect(video.playbackRate).toBe(1);console.log('Two overlapping captures ended at first capture temporary position 10s/rate 1x instead of original 40s/1.25x.');
});
