import {it,expect} from 'vitest';
import {himotokiEntryToWordTranslation} from './himotokiTypes';import {knownKeyOf} from '../shared/knownWords';import {buildRows,toCsv,toJson} from '../shared/exportWords';
it('dictionary-resolved known words export without headwords even though lookup supplied them',()=>{
 const t=himotokiEntryToWordTranslation({seq:1467640,source:'jitendex',kanji:['猫'],readings:['ねこ'],senses:[{glosses:['cat']}]},'猫');const key=knownKeyOf(t)!;
 expect(t.headword).toBe('猫');expect(key).toBe('seq:jitendex:1467640');const rows=buildRows([key],{[key]:'known'});expect(rows).toEqual([{key,headword:'',source:'jitendex',seq:'1467640',status:'known'}]);expect(toCsv(rows)).not.toContain('猫');expect(toJson(rows)).not.toContain('猫');console.log('Lookup headword:',t.headword,'; actual CSV:\n'+toCsv(rows));console.log('Actual JSON:\n'+toJson(rows));
 const fallback=buildRows(['hw:猫']);expect(fallback[0].headword).toBe('猫');console.log('Only fallback hw: keys retain headwords; normal seq: keys omit them.');
});
