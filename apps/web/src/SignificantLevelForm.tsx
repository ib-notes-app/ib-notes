// SPDX-License-Identifier: MPL-2.0
import { useRef, useState, type FormEvent } from 'react';
import { Temporal } from '@js-temporal/polyfill';
import { checkpointInstant } from '@ib-field-notes/session-templates';
import { formatPriceNumber, type JournalSession, type SignificantLevel, type SignificantLevelUpdate } from '@ib-field-notes/domain';
import { levelTypeLabels, levelTimeframeLabels, readLevelEntryChoices, rememberLevelEntryChoices } from './LevelChoices';

const typeHelp = {
  low: 'Your price entries track breaks below and returns above this low.',
  high: 'Your price entries track breaks above and returns below this high.',
  gap: 'Your price entries track moves around this gap level or zone.',
  other: 'Your price entries track crossings of this price or zone.',
};

export function levelOriginFromInput(
  level: Pick<SignificantLevel, 'originAt' | 'originTimePrecision'> | null,
  date: string, time: string, timeZone: string,
): Pick<SignificantLevel, 'originAt' | 'originTimePrecision'> {
  if (!time) return { originAt: null, originTimePrecision: 'unknown' };
  if (!date) throw new Error('Choose the date this level formed.');
  const previous = level?.originAt ? Temporal.Instant.from(level.originAt).toZonedDateTimeISO(timeZone) : null;
  if (previous && date === previous.toPlainDate().toString() && time === previous.toPlainTime().toString({ smallestUnit: 'minute' })) {
    // Editing a label must not round an older timestamp or upgrade approximate evidence.
    return { originAt: level!.originAt, originTimePrecision: level!.originTimePrecision };
  }
  return { originAt: checkpointInstant(date, time, timeZone).toString(), originTimePrecision: 'exact' };
}

const priceText = (value: number | null | undefined) => value == null ? '' : formatPriceNumber(value);
const parsePrice = (value: string) => value.trim() && Number.isFinite(Number(value)) ? Number(value) : null;

export function SignificantLevelForm({ session, level, onSave, onCancel }: {
  session: JournalSession;
  level: SignificantLevel | null;
  onSave: (update: SignificantLevelUpdate, originAt: string | null) => Promise<string | null>;
  onCancel: () => void;
}) {
  const origin = level?.originAt ? Temporal.Instant.from(level.originAt).toZonedDateTimeISO(session.displayTimeZone) : null;
  const [choices] = useState(() => readLevelEntryChoices(session.journalId));
  const [levelType, setLevelType] = useState(level?.levelType ?? choices.levelType);
  const [shape, setShape] = useState(level?.shape ?? choices.shape);
  const [price, setPrice] = useState(priceText(level?.price));
  const [zoneLow, setZoneLow] = useState(priceText(level?.zoneLow));
  const [zoneHigh, setZoneHigh] = useState(priceText(level?.zoneHigh));
  const [sourceTimeframe, setSourceTimeframe] = useState(level?.sourceTimeframe ?? choices.sourceTimeframe);
  const [originDate, setOriginDate] = useState(origin?.toPlainDate().toString() ?? session.rthDate);
  const [originTime, setOriginTime] = useState(origin?.toPlainTime().toString({ smallestUnit: 'minute' }) ?? '');
  const [label, setLabel] = useState(level?.label ?? '');
  const [note, setNote] = useState(level?.note ?? '');
  const [producedTwentyPlus, setProducedTwentyPlus] = useState(level?.producedTwentyPlus ?? false);
  const [direction, setDirection] = useState(level?.qualifyingMoveDirection ?? (levelType === 'high' ? 'down' : 'up'));
  const [points, setPoints] = useState(priceText(level?.qualifyingMovePoints));
  const priceInput = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState('');

  function resetEntry() {
    setPrice(''); setZoneLow(''); setZoneHigh(''); setLabel(''); setNote('');
    setOriginDate(session.rthDate); setOriginTime('');
    setProducedTwentyPlus(false); setPoints('');
    setDirection('up');
    setLevelType('low'); setShape('single_price'); setSourceTimeframe('unknown');
    setError(null); setResetMessage('Form reset. Your saved levels are unchanged.');
    // Wait for Price/Zone switching to commit before focusing the fresh input.
    requestAnimationFrame(() => priceInput.current?.focus());
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true;
    setBusy(true); setError(null); setResetMessage('');
    try {
      const enteredOrigin = levelOriginFromInput(level, originDate, originTime, session.displayTimeZone);
      const failure = await onSave({ levelType, shape,
        price: shape === 'single_price' ? parsePrice(price) : null,
        zoneLow: shape === 'price_zone' ? parsePrice(zoneLow) : null,
        zoneHigh: shape === 'price_zone' ? parsePrice(zoneHigh) : null,
        originTimePrecision: enteredOrigin.originTimePrecision, sourceTimeframe,
        producedTwentyPlus, qualifyingMoveDirection: producedTwentyPlus ? direction : null,
        qualifyingMovePoints: producedTwentyPlus ? parsePrice(points) : null,
        label, note, currentPrice: null,
      }, enteredOrigin.originAt);
      setError(failure);
      if (!failure && !level) {
        rememberLevelEntryChoices(session.journalId, { levelType, shape, sourceTimeframe });
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { saving.current = false; setBusy(false); }
  }

  return <form className="significant-level-form" aria-label={level ? 'Edit level' : 'Add Level'} onSubmit={submit}>
    <header className="level-form-heading">
      <h2>{level ? 'Edit level' : 'Add Level'}</h2>
      <button className="primary-action" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      <div className="level-heading-actions">
        {!level && <button type="button" onClick={resetEntry} disabled={busy}>Reset form</button>}
        <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </header>

    <div className="level-form-grid">
      <label>Type<select aria-label="Type" value={levelType} onChange={event => {
        const next = event.target.value as SignificantLevelUpdate['levelType'];
        setLevelType(next);
        if (!producedTwentyPlus) setDirection(next === 'high' ? 'down' : 'up');
      }}>
        {Object.entries(levelTypeLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select></label>
      <label>Timeframe<select aria-label="Timeframe" value={sourceTimeframe} onChange={event => setSourceTimeframe(event.target.value as SignificantLevel['sourceTimeframe'])}>
        {Object.entries(levelTimeframeLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select></label>
      {shape === 'single_price'
        ? <label className="level-main-price">Level price<input ref={priceInput} inputMode="decimal" required value={price} onChange={event => setPrice(event.target.value)} /></label>
        : <>
          <label className="level-main-price">Zone low<input ref={priceInput} inputMode="decimal" required value={zoneLow} onChange={event => setZoneLow(event.target.value)} /></label>
          <label className="level-main-price">Zone high<input inputMode="decimal" required value={zoneHigh} onChange={event => setZoneHigh(event.target.value)} /></label>
        </>}
      <label className={shape === 'price_zone' ? 'level-full-row' : undefined}>Shape<select aria-label="Shape" value={shape} onChange={event => setShape(event.target.value as SignificantLevelUpdate['shape'])}>
        <option value="single_price">Price</option><option value="price_zone">Zone</option>
      </select></label>
    </div>

    <p className="level-type-help">{typeHelp[levelType]}</p>

    <div className="level-form-origin">
      <div className="level-origin-heading"><span>When it formed <small>optional</small></span>
        {originTime && <button type="button" onClick={() => setOriginTime('')}>Clear time</button>}
      </div>
      <div className="level-form-grid">
        <label className="context-picker-field">Date
          <span className="context-picker-readout" aria-hidden="true">{originDate ? Temporal.PlainDate.from(originDate).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Choose date'}</span>
          <input className="native-picker-overlay" aria-label="Origin date" type="date" required={Boolean(originTime)} value={originDate} onChange={event => setOriginDate(event.target.value)} />
        </label>
        <label className="context-picker-field">Time
          <span className={`context-picker-readout${originTime ? '' : ' time-unset'}`} aria-hidden="true">{originTime ? Temporal.PlainTime.from(originTime).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'Add time'}</span>
          <input className="native-picker-overlay" aria-label="Origin time" type="time" value={originTime} onChange={event => setOriginTime(event.target.value)} />
        </label>
      </div>
    </div>

    <div className="level-form-extras">
      <div className="level-form-grid">
        <label><span>Short label <small>optional</small></span><input value={label} placeholder="Prior low, gap…" onChange={event => setLabel(event.target.value)} /></label>
        <label><span>Level note <small>optional</small></span><textarea rows={1} value={note} placeholder="Add note" onChange={event => setNote(event.target.value)} /></label>
      </div>
        <label className="level-form-check"><input type="checkbox" checked={producedTwentyPlus} onChange={event => setProducedTwentyPlus(event.target.checked)} />Produced 20+ points</label>
        {producedTwentyPlus && <div className="level-form-grid">
          <label>Move direction<select value={direction} onChange={event => setDirection(event.target.value as 'up' | 'down')}>
            <option value="up">Up</option><option value="down">Down</option>
          </select></label>
          <label><span>Move points <small>optional</small></span><input inputMode="decimal" value={points} placeholder="20 or more" onChange={event => setPoints(event.target.value)} /></label>
        </div>}
    </div>
    <p role="status" className="visually-hidden">{resetMessage}</p>
    {error && <p role="alert" className="form-error">{error}</p>}
  </form>;
}
