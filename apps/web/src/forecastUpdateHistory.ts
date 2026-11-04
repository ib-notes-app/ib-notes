// SPDX-License-Identifier: MPL-2.0
import { useEffect, useMemo, useRef, useState } from 'react';
import { Temporal } from '@js-temporal/polyfill';
import { canRecordForecastUpdate, forecastUpdateInput, type ForecastUpdate, type JournalSession,
  type BestFitOutlook, type deriveSessionIbRead, type SignificantLevel,
  type HistoricalIbImportBatch, type ContextBatch, type FbdBatch, type PriceHistoryBatch } from '@ib-field-notes/domain';
import type { JournalRepository } from '@ib-field-notes/storage-port';
import { awaitOvernightWrites } from './OvernightStudy';
import {ibForecastCheckpoint,selectIbCheckpointUpdate} from './ibForecastCheckpoint';

const pendingWrites = new Set<Promise<void>>();
export async function awaitForecastUpdateWrites() {
  await Promise.allSettled([...pendingWrites]);
  await awaitOvernightWrites();
}

function merge(rows: ForecastUpdate[], incoming: ForecastUpdate[]) {
  return [...new Map([...rows, ...incoming].map(row => [row.id, row])).values()]
    .sort((a, b) => Date.parse(a.issuedAt) - Date.parse(b.issuedAt));
}

export function useForecastUpdateHistory(args: {
  session: JournalSession; repository: JournalRepository | null; ready: boolean;
  current: ReturnType<typeof deriveSessionIbRead>; outlook: BestFitOutlook | null;
  levels: SignificantLevel[]; batches: HistoricalIbImportBatch[]; news: ContextBatch[]; lowBatches: FbdBatch[];
  priceBatches?:PriceHistoryBatch[];
}) {
  const { session, repository, current, outlook } = args;
  const [history, setHistory] = useState({ sessionId: session.id, rows: session.forecastUpdates ?? [] });
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef<string | null>(null);
  const attemptedCheckpoint = useRef<string | null>(null);
  const mounted = useRef(false);
  const sessionId = useRef(session.id);
  sessionId.current = session.id;
  useEffect(()=>{ mounted.current=true; return ()=>{ mounted.current=false; }; },[]);
  const rows = useMemo(()=>merge(history.sessionId===session.id?history.rows:[],session.forecastUpdates??[]),
    [history,session.id,session.forecastUpdates]);
  const revision = useMemo(() => session.close.finishedAt ? null : forecastUpdateInput(session,[current?.phase,current?.high,current?.low,
    outlook?.modelVersion,outlook?.formingWidth?.version,outlook?.ibReturn?.modelVersion,outlook?.auctionContext,
    [...args.levels].sort((a,b)=>a.id.localeCompare(b.id)),
    [...args.batches].sort((a,b)=>a.id.localeCompare(b.id)).map(b => [b.id, b.contentSha256, b.importedAt]),
    [...args.news].sort((a,b)=>a.id.localeCompare(b.id)).map(b => [b.id, b.contentSha256, b.importedAt]),
    [...args.priceBatches??[]].sort((a,b)=>a.id.localeCompare(b.id)).map(b=>[b.id,b.contentSha256,b.importedAt]),
    [...args.lowBatches].sort((a,b)=>a.id.localeCompare(b.id)).map(b => [b.id, b.importedAt])]),
    [session,current?.phase,current?.high,current?.low,outlook?.modelVersion,outlook?.formingWidth?.version,outlook?.ibReturn?.modelVersion,outlook?.auctionContext,args.levels,args.batches,args.news,args.lowBatches,args.priceBatches]);
  useEffect(() => {
    let active = true;
    setError(null);
    if (!repository || session.close.finishedAt) return;
    void repository.getSession(session.id).then(saved => {
      if (!active || !saved) return;
      setHistory(old => ({ sessionId: session.id,
        rows: merge(old.sessionId === session.id ? old.rows : [], saved.forecastUpdates) }));
    }).catch(() => { if (active) setError('Saved forecast updates could not be read.'); });
    return () => { active = false; };
  }, [repository, session.id, session.updatedAt]);

  useEffect(() => {
    if (!repository || !revision || !args.ready || !outlook || !current || current.phase === 'PENDING' ||
        current.high === null || current.low === null || !session.forecast ||
        !canRecordForecastUpdate(session, Temporal.Now.instant().toString())) return;
    const point=ibForecastCheckpoint(session),at=Date.parse(outlook.asOf);
    const checkpointKey=point?`${session.id}:${session.forecast.issuedAt}:${point.at}`:null;
    const checkpointDue=!!point&&current.phase==='FORMING'&&at>=point.at&&at<point.until&&
      attemptedCheckpoint.current!==checkpointKey&&!selectIbCheckpointUpdate(session,rows,outlook.asOf)?.atCheckpoint;
    if(attempted.current===revision&&!checkpointDue)return;
    attempted.current = revision;
    if(checkpointDue)attemptedCheckpoint.current=checkpointKey;
    const capture = async () => {
      const captureKey=checkpointDue?`${revision}:ib-45-minute:${point!.at}`:revision;
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(captureKey));
      const id = [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
      if (rows.some(row => row.id === id)) return;
      const update: ForecastUpdate = {
        version: 1, id, sessionId: session.id, journalId: session.journalId, contract: session.contract,
        originalIssuedAt: session.forecast!.issuedAt, sessionUpdatedAt: session.updatedAt,
        issuedAt: outlook.asOf, asOf: outlook.asOf, modelVersion: outlook.modelVersion,
        estimate: structuredClone(outlook.estimate), phase: current.phase as 'FORMING' | 'LOCKED',
        high: current.high!, low: current.low!, price: current.read.latest?.price ?? null,
        priceAt: outlook.priceAt, recordedEdges: outlook.recordedEdges, settled: outlook.settled,
        support: outlook.support, historicalDays: outlook.historicalDays, matchingDays: outlook.matchingDays,
        effectiveDays: outlook.effectiveDays, pathDays: outlook.pathDays, memoryDays: outlook.memoryDays,
        ...(outlook.remainingEdge?{remainingEdge:structuredClone(outlook.remainingEdge)}:{}),
        ...(outlook.formingWidth?{formingWidth:structuredClone(outlook.formingWidth)}:{}),
        ...(outlook.ibReturn?{ibReturn:structuredClone(outlook.ibReturn)}:{}),
        ...(outlook.auctionContext?{auctionContext:structuredClone(outlook.auctionContext),auctionDays:outlook.auctionDays??0}:{}),
        sourceRowIds: [...outlook.sourceRowIds], referenceBatchIds: [...outlook.referenceBatchIds],
        contextSources: { levels: args.levels.map(l => l.id),
          lowBatches: args.lowBatches.map(b => b.id), newsBatches: args.news.map(b => b.id),
          priceBatches: [...outlook.referencePriceBatchIds??[]] },
      };
      const saved = await repository.appendForecastUpdate(session.id, update);
      if (mounted.current && sessionId.current === session.id) {
        setHistory(old => ({ sessionId: session.id, rows: merge(old.sessionId === session.id ? old.rows : [], saved) }));
        setError(null);
      }
    };
    const write = capture();
    pendingWrites.add(write);
    void write.catch(() => { if (mounted.current && sessionId.current === session.id) setError('This forecast update could not be saved. Your journal entry is still saved.'); })
      .finally(() => pendingWrites.delete(write));
  }, [repository, args.ready, revision, session, current, outlook, rows]);
  return { updates: rows, error };
}
