import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

export const TOUR_LENGTH = 16500;

export function pauseJourneyNavigation() { gsap.killTweensOf(window); }

export function navigateJourney(progress: number, reducedMotion: boolean) {
  gsap.to(window, {
    scrollTo: { y: progress * TOUR_LENGTH, autoKill: true },
    duration: reducedMotion ? 0 : Math.min(4, Math.max(.9, Math.abs(window.scrollY / TOUR_LENGTH - progress) * 10)),
    ease: 'power2.inOut', overwrite: 'auto',
  });
}

/** One GSAP playhead drives camera position, hinge rotation, light, and labels. */
export function createScrollJourney(element: HTMLElement, reducedMotion: boolean, update: (progress: number) => void) {
  const playhead = { progress: 0 };
  const timeline = gsap.timeline({
    scrollTrigger: {
      id: 'living-gallery-journey',
      trigger: element,
      start: 'top top',
      end: `+=${TOUR_LENGTH}`,
      scrub: reducedMotion ? true : .38,
      invalidateOnRefresh: true,
    },
  });
  timeline.to(playhead, { progress: 1, duration: 1, ease: 'none', onUpdate: () => update(playhead.progress) });
  timeline.progress(Math.min(1, Math.max(0, window.scrollY / TOUR_LENGTH)));
  const refresh = requestAnimationFrame(() => ScrollTrigger.refresh());
  return () => { cancelAnimationFrame(refresh); timeline.scrollTrigger?.kill(); timeline.kill(); gsap.killTweensOf(window); };
}
