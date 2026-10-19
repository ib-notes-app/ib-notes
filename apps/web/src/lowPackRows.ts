// SPDX-License-Identifier: MPL-2.0
import type {FbdBatch,HistoricalLow} from '@ib-field-notes/domain';
import type {JournalRepository} from '@ib-field-notes/storage-port';

// Immutable pack rows are shared by the quality reader and the Levels browser.
// Repository identity separates journals/restored storage connections.
const caches=new WeakMap<JournalRepository,Map<string,{revision:string;rows:Promise<HistoricalLow[]>}>>();
const revision=(batch:FbdBatch)=>JSON.stringify([batch.contentSha256,batch.importedAt]);
export function loadLowPackRows(repository:JournalRepository,batch:FbdBatch):Promise<HistoricalLow[]> {
  let cache=caches.get(repository);
  if(!cache){cache=new Map();caches.set(repository,cache);}
  const saved=cache.get(batch.id),key=revision(batch);
  if(saved?.revision===key)return saved.rows;
  const entry={revision:key,rows:repository.getFbdLows(batch.id)};
  cache.set(batch.id,entry);
  void entry.rows.catch(()=>{if(cache!.get(batch.id)===entry)cache!.delete(batch.id);});
  return entry.rows;
}
export function retainLowPackRows(repository:JournalRepository,batches:FbdBatch[]) {
  const cache=caches.get(repository);
  if(!cache)return;
  const installed=new Map(batches.map(batch=>[batch.id,revision(batch)]));
  for(const [id,entry]of cache)if(installed.get(id)!==entry.revision)cache.delete(id);
}
