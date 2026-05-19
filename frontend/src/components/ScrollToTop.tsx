import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

function resetScroll() {
  const main = document.querySelector('main');
  if (main) {
    main.scrollTop = 0;
    main.scrollLeft = 0;
  }
  window.scrollTo(0, 0);
}

/** Resets scroll on route change so nested <main> panels show new page content immediately. */
export default function ScrollToTop() {
  const { pathname, key } = useLocation();

  useLayoutEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useLayoutEffect(() => {
    resetScroll();
    const raf1 = requestAnimationFrame(() => {
      resetScroll();
      requestAnimationFrame(resetScroll);
    });
    const t = window.setTimeout(resetScroll, 0);
    return () => {
      cancelAnimationFrame(raf1);
      window.clearTimeout(t);
    };
  }, [pathname, key]);

  return null;
}
