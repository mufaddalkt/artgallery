import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { artworks } from './data/artworks';
import type { Artwork } from './data/artworks';
import { ART_STOPS, stopPositions } from './scene/timeline';
import { createMuseum } from './scene/museum';
import { createScrollJourney, navigateJourney, pauseJourneyNavigation, TOUR_LENGTH } from './scene/scroll';

const rooms = ['Across Time', 'Light & Shadow', 'The Art of Looking', 'Inner Worlds'];
const roomNumbers = ['I', 'II', 'III', 'IV'];

function Mark() {
  return <svg viewBox="0 0 34 38" fill="none" aria-hidden="true"><path d="M3 36V9L17 2l14 7v27M10 36V13h14v23M17 13v23" stroke="currentColor" strokeWidth="1.1" /></svg>;
}
function Arrow({ backwards = false }: { backwards?: boolean }) {
  return <svg className={backwards ? 'back-arrow' : ''} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.2" /></svg>;
}

function useRoomTone() {
  const audio = useRef<{ context: AudioContext; gain: GainNode; source: AudioBufferSourceNode } | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => () => { void audio.current?.context.close(); }, []);
  const toggle = async () => {
    try {
      if (!audio.current) {
        const context = new AudioContext();
        const buffer = context.createBuffer(1, context.sampleRate * 5, context.sampleRate);
        const channel = buffer.getChannelData(0); let previous = 0;
        for (let i = 0; i < channel.length; i++) { previous = (previous + (Math.random() * 2 - 1) * .025) / 1.025; channel[i] = previous * 4; }
        const source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
        const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 420;
        const gain = context.createGain(); gain.gain.value = 0;
        source.connect(filter); filter.connect(gain); gain.connect(context.destination); source.start();
        audio.current = { context, source, gain };
      }
      await audio.current.context.resume();
      audio.current.gain.gain.setTargetAtTime(on ? 0 : .07, audio.current.context.currentTime, .5);
      setOn(!on);
    } catch { setOn(false); }
  };
  return { on, toggle };
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const resumeProgressRef = useRef(0);
  const destinationRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(-1);
  const [opacity, setOpacity] = useState(0);
  const [room, setRoom] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reading, setReading] = useState(false);
  const [loaded, setLoaded] = useState(0);
  const [reduced, setReduced] = useState(() => {
    try { const saved = localStorage.getItem('living-gallery-motion'); if (saved) return saved === 'reduced'; } catch { /* Storage may be unavailable in private sessions. */ }
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const [freeLook, setFreeLook] = useState(false);
  const reducedRef = useRef(reduced); reducedRef.current = reduced;
  const freeLookRef = useRef(freeLook); freeLookRef.current = freeLook;
  const [panel, setPanel] = useState<'guide' | 'story' | null>(null);
  const [storyIndex, setStoryIndex] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const tone = useRoomTone();
  const fallback = reading || failed;
  const art = active >= 0 ? artworks[active] : null;
  const goTo = useCallback((value: number) => {
    setPanel(null);
    destinationRef.current = value;
    navigateJourney(value, reducedRef.current);
  }, []);

  function chooseMotion(value: boolean) {
    setReduced(value);
    try { localStorage.setItem('living-gallery-motion', value ? 'reduced' : 'cinematic'); } catch { /* Motion still works without storage. */ }
  }

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      try { if (localStorage.getItem('living-gallery-motion')) return; } catch { /* Respect the system when storage is unavailable. */ }
      setReduced(media.matches);
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const manualInput = () => { destinationRef.current = null; };
    window.addEventListener('wheel', manualInput, { passive: true });
    window.addEventListener('touchstart', manualInput, { passive: true });
    return () => { window.removeEventListener('wheel', manualInput); window.removeEventListener('touchstart', manualInput); };
  }, []);
  useEffect(() => {
    if (fallback || !scrollRef.current) return;
    return createScrollJourney(scrollRef.current, reduced, value => { progressRef.current = value; });
  }, [fallback, reduced]);
  useEffect(() => {
    if (fallback || !canvasRef.current) return;
    setReady(false);
    let museum: ReturnType<typeof createMuseum> | undefined;
    try {
      museum = createMuseum(canvasRef.current, {
        getProgress: () => progressRef.current,
        getReducedMotion: () => reducedRef.current,
        getFreeLook: () => freeLookRef.current,
        onFrame: (p, a, o, r) => { setProgress(p); setActive(a); setOpacity(o); setRoom(r); },
        onReady: () => setReady(true), onError: () => setFailed(true), onLoad: setLoaded,
      });
    } catch (error) { console.error('The 3D gallery could not initialize.', error); setFailed(true); }
    return () => museum?.dispose();
  }, [fallback]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (panel && dialog && !dialog.open) dialog.showModal();
    if (!panel && dialog?.open) dialog.close();
    document.body.style.overflow = panel ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [panel]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (panel || fallback || /INPUT|SELECT|TEXTAREA/.test(tag) || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === ' ' && /BUTTON|A/.test(tag)) return;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'ArrowLeft', 'ArrowUp', 'PageUp', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        if (e.key === 'Home') { goTo(0); return; }
        if (e.key === 'End') { goTo(1); return; }
        const forward = ['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key);
        const current = destinationRef.current ?? window.scrollY / TOUR_LENGTH;
        const next = forward ? stopPositions.find(p => p > current + .015) ?? 1 : [...stopPositions].reverse().find(p => p < current - .015) ?? 0;
        goTo(next);
      }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [goTo, panel, fallback]);

  function showStory(index: number) { pauseJourneyNavigation(); destinationRef.current = null; setStoryIndex(index); setPanel('story'); }
  function setReadingView(value: boolean) {
    pauseJourneyNavigation(); destinationRef.current = null;
    if (value) resumeProgressRef.current = progressRef.current;
    const savedProgress = resumeProgressRef.current;
    setPanel(null); setReading(value);
    if (!value) setFailed(false);
    requestAnimationFrame(() => window.scrollTo({ top: value ? 0 : savedProgress * TOUR_LENGTH, behavior: 'instant' }));
  }

  return <>
    <a className="skip-link" href="#reading-room" onClick={e => { e.preventDefault(); setReadingView(true); }}>Explore the accessible collection</a>
    {fallback ? <main className="reading-room" id="reading-room">
      <header className="reading-header"><div className="wordmark"><Mark /><span>THE LIVING<br />GALLERY</span></div><button className="text-button" onClick={() => setReadingView(false)}>Enter the 3D gallery <Arrow /></button></header>
      <div className="reading-intro"><span className="eyebrow">THE COLLECTION / EIGHT ENCOUNTERS</span><h1>Art, at your own pace.</h1><p>{failed ? 'Your device could not open the 3D environment. Every masterpiece and its story is available here.' : 'An accessible reading room for a closer encounter with the collection.'}</p></div>
      <div className="reading-collection">{artworks.map((a, i) => <article key={a.id}><img src={a.image} alt={a.alt} loading="lazy" width={a.width} height={a.height} /><div><span className="eyebrow">{String(i + 1).padStart(2, '0')} / {a.period}</span><h2>{a.title}</h2><p className="artist">{a.artist} · {a.date}</p><p>{a.description}</p><button className="text-button" onClick={() => showStory(i)}>Discover the story <Arrow /></button></div></article>)}</div>
      <p className="reading-note">A virtual exhibition of licensed reproductions. Original works remain in their respective collections. Image credits and research sources accompany every story.</p>
    </main> : <>
      <div className="world" aria-hidden="true"><canvas ref={canvasRef} /><div className="edge-shade" /></div>
      <div ref={scrollRef} className="tour-scroll" style={{ height: `calc(${TOUR_LENGTH}px + 100dvh)` }} aria-hidden="true" />
      <div className={`loading ${ready ? 'is-ready' : ''}`} role="status"><Mark /><p>Preparing your visit</p><span>A little space for wonder.</span><i /></div>
      <header className={`museum-header ${ready ? 'visible' : ''}`}>
        <button className="wordmark" onClick={() => goTo(0)} aria-label="The Living Gallery — return to entrance"><Mark /><span>THE LIVING<br />GALLERY</span></button>
        <div className="room-name"><span>{progress < .135 ? 'A PRIVATE ENCOUNTER WITH ART' : progress > .95 ? 'THE ROTUNDA' : `GALLERY ${roomNumbers[Math.max(0, Math.min(3, room))]} / ${rooms[Math.max(0, Math.min(3, room))]}`}</span></div>
        <button className="guide-button" onClick={() => setPanel('guide')} aria-label="Visitor guide" aria-haspopup="dialog"><span>Visitor guide</span><i><b /><b /></i></button>
      </header>
      <main className="gallery-interface" aria-label="The Living Gallery guided museum tour">
        <div className="entrance-caption" style={{ opacity: Math.max(0, 1 - progress / .038), visibility: progress < .05 ? 'visible' : 'hidden' }}>
          <p>EIGHT MASTERPIECES. ONE TIMELESS JOURNEY.</p>
          <button onClick={() => goTo(reduced ? ART_STOPS[0] : .045)} className="enter-button"><span>SCROLL TO ENTER</span><i /></button>
          <span className="entrance-key">or use your arrow keys</span>
          {reduced && <button className="motion-invitation" onClick={() => chooseMotion(false)}>Enable cinematic motion <Arrow /></button>}
        </div>
        {art && <article className="art-caption" style={{ '--reveal': opacity } as CSSProperties} aria-live="polite" aria-atomic="true">
          <span className="eyebrow">{String(active + 1).padStart(2, '0')} — {art.period}</span>
          <h1>{art.title}</h1>
          <p className="artist">{art.artist}<span>·</span>{art.date}</p>
          <p className="art-description">{art.description}</p>
          <button className="text-button" onClick={() => showStory(active)} tabIndex={opacity < .3 ? -1 : 0}>Discover the story <Arrow /></button>
        </article>}
        <div className={`ending ${progress > .972 ? 'visible' : ''}`} aria-hidden={progress <= .972}>
          <span className="eyebrow">THE JOURNEY STAYS WITH YOU</span><h1>Art outlives<br /><em>its moment.</em></h1><p>Thank you for exploring The Living Gallery.</p>
          <div><button className="text-button" onClick={() => goTo(0)} tabIndex={progress > .972 ? 0 : -1}>Return to Entrance <Arrow backwards /></button><button className="text-button" onClick={() => goTo(ART_STOPS[0])} tabIndex={progress > .972 ? 0 : -1}>Explore Again <Arrow /></button></div>
        </div>
      </main>
      <footer className={`museum-footer ${ready ? 'visible' : ''}`}>
        <div className="journey-hint"><span className="tiny-line" /><span>{reduced ? 'LOW MOTION / ARROW KEYS TO EXPLORE' : progress > .97 ? 'A MOMENT TO REFLECT' : progress < .08 ? 'YOUR VISIT BEGINS HERE' : active >= 0 && opacity > .9 ? 'PAUSE. LOOK CLOSER.' : 'SCROLL TO WANDER'}</span></div>
        <nav className="journey-progress" aria-label="Jump to a masterpiece"><span>{progress < .14 ? '00' : String(Math.min(8, Math.max(1, Math.floor((progress - .156) / .097) + 1))).padStart(2, '0')}</span><div>{artworks.map((a, i) => <button key={a.id} onClick={() => goTo(ART_STOPS[i])} aria-label={`View ${a.title}`} title={a.title} aria-current={active === i ? 'step' : undefined} className={progress >= ART_STOPS[i] - .02 ? 'visited' : ''}><i /></button>)}</div><span>08</span></nav>
        <button className={`sound-button ${tone.on ? 'enabled' : ''}`} onClick={() => void tone.toggle()} aria-pressed={tone.on} aria-label={tone.on ? 'Mute ambient sound' : 'Enable ambient sound'}><span className="sound-wave"><i /><i /><i /><i /><i /></span><span>SOUND {tone.on ? 'ON' : 'OFF'}</span></button>
      </footer>
      <div className="edge-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
      <span className="sr-only" role="status">{active >= 0 ? `Viewing ${artworks[active].title} by ${artworks[active].artist}.` : progress < .12 ? 'At the museum entrance. Scroll or press Arrow Down to enter.' : progress > .97 ? 'The tour is complete.' : 'Moving through the gallery.'}</span>
    </>}
    <dialog ref={dialogRef} className={`museum-dialog ${panel === 'story' ? 'story-dialog' : 'guide-dialog'}`} onCancel={() => setPanel(null)} aria-labelledby="dialog-title" onClick={e => { if (e.target === e.currentTarget) setPanel(null); }}>
      <div className="dialog-inner"><button className="close-button" onClick={() => setPanel(null)} aria-label="Close dialog">×</button>
        {panel === 'guide' ? <>
          <span className="eyebrow">MAKE YOURSELF AT HOME</span><h2 id="dialog-title">A guide to your visit.</h2>
          <p className="guide-intro">Scroll to walk. Pause to look. Scroll back to return.<br />Take as long as a painting asks of you.</p>
          <div className="guide-artworks">{artworks.map((a, i) => <button key={a.id} onClick={() => goTo(ART_STOPS[i])}><span>{String(i + 1).padStart(2, '0')}</span><div><strong>{a.title}</strong><small>{a.artist}</small></div><Arrow /></button>)}</div>
          <div className="guide-preferences"><label><span>Reduced motion<small>Stationary views of each masterpiece</small></span><input type="checkbox" checked={reduced} onChange={e => chooseMotion(e.target.checked)} /></label><label><span>Subtle mouse look<small>Gently look around on desktop</small></span><input type="checkbox" checked={freeLook} disabled={reduced} onChange={e => setFreeLook(e.target.checked)} /></label></div>
          <div className="guide-bottom"><button className="text-button" onClick={() => setReadingView(true)}>Accessible reading room <Arrow /></button><button className="text-button" onClick={() => goTo(0)}>Return to entrance <Arrow backwards /></button></div>
          <p className="guide-note">Arrow keys or Page Up / Down move between artworks. Home returns to the entrance; End opens the rotunda. On touch screens, swipe vertically. {loaded} of 8 full-resolution works prepared.</p>
        </> : panel === 'story' ? <ArtworkStory art={artworks[storyIndex]} /> : null}
      </div>
    </dialog>
  </>;
}

function ArtworkStory({ art }: { art: Artwork }) {
  return <>
    <span className="eyebrow">A CLOSER ENCOUNTER / {art.period}</span><h2 id="dialog-title">{art.title}</h2><p className="story-artist">{art.artist} · {art.date}</p>
    <img className="story-image" src={art.image} alt={art.alt} width={art.width} height={art.height} />
    <p className="story-body">{art.story}</p>
    <div className="story-fact"><span className="eyebrow">LOOK A LITTLE CLOSER</span><p>{art.fact}</p></div>
    <dl className="art-details"><div><dt>Medium</dt><dd>{art.medium}</dd></div><div><dt>Collection</dt><dd>{art.collection}</dd></div><div><dt>Period</dt><dd>{art.period}</dd></div></dl>
    <div className="source-credit"><span className="eyebrow">IMAGE & RESEARCH</span><p>{art.credit}<br />{art.imageChanges}</p><div><a href={art.sourceUrl} target="_blank" rel="noreferrer">Collection record ↗</a><a href={art.imageSourceUrl} target="_blank" rel="noreferrer">Image source ↗</a><a href={art.licenseUrl} target="_blank" rel="noreferrer">{art.license} ↗</a></div><p>Presented as a digital reproduction in an imagined museum; original proportions are preserved.</p></div>
  </>;
}
