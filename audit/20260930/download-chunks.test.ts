import {afterEach,describe,expect,it,vi} from 'vitest';import {gzipSync} from 'node:zlib';import {createRequire} from 'node:module';import {mkdtempSync,readFileSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite');
const env=vi.hoisted(()=>({pool:null as any}));vi.mock('@sqlite.org/sqlite-wasm',()=>({default:async()=>({installOpfsSAHPoolVfs:async()=>env.pool})}));
afterEach(()=>vi.unstubAllGlobals());
describe('audit: stream header detection in actual dictionary worker',()=>{
 it('valid gzip and raw SQLite headers are rejected when split across chunks',async()=>{
 const imports=vi.fn(async()=>0);env.pool={getFileNames:()=>[],getCapacity:()=>4,addCapacity:async()=>4,importDb:imports,unlink:()=>true};const replies:any[]=[];const worker:any={postMessage:(x:any)=>replies.push(x)};vi.stubGlobal('self',worker);await import('../pages/offscreen/dict.worker');
 for(const kind of ['gzip','SQLite']){const dir=mkdtempSync(join(tmpdir(),'dict-header-'));const path=join(dir,'fixture.sqlite');const db=new DatabaseSync(path);db.exec('CREATE TABLE term(expression TEXT,reading TEXT);');db.close();const raw=new Uint8Array(readFileSync(path));rmSync(dir,{recursive:true});const full=kind==='gzip'?new Uint8Array(gzipSync(raw)):raw;vi.stubGlobal('fetch',vi.fn(async()=>new Response(new ReadableStream({start(controller){controller.enqueue(full.slice(0,1));controller.enqueue(full.slice(1));controller.close()}}))));await worker.onmessage({data:{id:kind,op:'install',url:'https://dict.test/dict.sqlite.gz'}});const response=replies.at(-1);expect(response.ok).toBe(false);expect(response.error).toContain('neither gzip nor a SQLite database');console.log(kind,'first chunk length=1:',response.error.split('\n')[0]);}
 expect(imports).not.toHaveBeenCalled();
 });
});
