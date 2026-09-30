import {describe,it,expect} from 'vitest';
import {himotokiEntryToWordTranslation,entryLemma} from './himotokiTypes';
import fixtures from '../../.audit/kana-api-fixtures.json';
describe('Sub online usually-kana contract',()=>{for(const {q,row} of fixtures)it(q,()=>{
 expect(row.usually_kana).toBe(true);const result=himotokiEntryToWordTranslation(row,q);expect(result.headword).toBe(row.kanji[0]);expect(result.headword).not.toBe(q);expect(result.himotokiSave?.headword).toBe(row.kanji[0]);expect(entryLemma({surface:q,best:row})).toBe(row.kanji[0]);console.log(q,'-> displayed/saved',result.headword,'despite API usually_kana=true');
});});
