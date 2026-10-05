import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function initLenis() {
  // Check if reduced motion is requested
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    return null;
  }

  // Configure smooth scrolling without hijacking or blocking native cursor wheel events
  const lenis = new Lenis({
    lerp: 0.1,
    wheelMultiplier: 1.0,
    touchMultiplier: 1.0,
    orientation: 'vertical',
    gestureOrientation: 'vertical',
    smoothWheel: false, // Ensure cursor and mouse wheel scroll naturally everywhere
    syncTouch: false,
  });

  lenis.on('scroll', () => {
    ScrollTrigger.update();
  });

  let rafId: number;
  const raf = (time: number) => {
    lenis.raf(time);
    rafId = requestAnimationFrame(raf);
  };
  rafId = requestAnimationFrame(raf);

  return {
    lenis,
    destroy: () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    },
  };
}

export { gsap, ScrollTrigger };
