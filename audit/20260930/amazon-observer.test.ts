import {it,expect,vi,afterEach} from 'vitest';
import {createEvent,createStore} from 'effector';
const graph=vi.hoisted(()=>({videoStore:null as any,raw:vi.fn(),changed:vi.fn(),render:vi.fn()}));
vi.mock('../models/videos',()=>({$video:graph.videoStore}));
vi.mock('../models/subs',()=>({rawSubsAdded:graph.raw,esSubsChanged:graph.changed}));
vi.mock('../models/settings',()=>({esRenderSetings:graph.render}));
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('Amazon observers survive video replacement and old callbacks still publish old-video captions',async()=>{
 vi.useFakeTimers();const changed=createEvent<any>();graph.videoStore=createStore(null).on(changed,(_,v)=>v);
 const oldVideo={currentTime:90,src:'old.mp4'},newVideo={currentTime:2,src:'new.mp4'};let currentVideo=oldVideo;
 const sourceA={text:'古い動画',querySelectorAll(){return [{nodeType:3,textContent:this.text}];}},sourceB={text:'新しい動画',querySelectorAll(){return [{nodeType:3,textContent:this.text}];}};let currentSource=sourceA;
 const observers:any[]=[];class Observer{callback:any;target:any;disconnected=false;constructor(cb:any){this.callback=cb;observers.push(this);}observe(t:any){this.target=t;}disconnect(){this.disconnected=true;}}
 vi.stubGlobal('MutationObserver',Observer);vi.stubGlobal('Node',{TEXT_NODE:3});vi.stubGlobal('window',{setTimeout});
 vi.stubGlobal('document',{querySelector:(s:string)=>s==='.atvwebplayersdk-captions-overlay'?currentSource:currentVideo});
 const {default:Amazon}=await import('../streamings/amazon');const service=new Amazon();service.init();changed(oldVideo);await vi.advanceTimersByTimeAsync(300);
 expect(observers).toHaveLength(1);observers[0].callback();expect(graph.raw).toHaveBeenLastCalledWith([{start:90000,end:190000,text:'古い動画'}]);
 currentVideo=newVideo;currentSource=sourceB;changed(newVideo);await vi.advanceTimersByTimeAsync(300);
 expect(observers).toHaveLength(2);observers[1].callback();expect(graph.raw).toHaveBeenLastCalledWith([{start:2000,end:102000,text:'新しい動画'}]);
 sourceA.text='前の動画の遅い更新';observers[0].callback();expect(graph.raw).toHaveBeenLastCalledWith([{start:90000,end:190000,text:'前の動画の遅い更新'}]);
 expect(observers.every(o=>!o.disconnected)).toBe(true);console.log('Video replacement created 2 live observers; late old-node callback published old video text at 90s after new video text at 2s.');
});
