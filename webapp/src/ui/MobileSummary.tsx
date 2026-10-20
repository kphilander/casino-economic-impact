import { useEffect, useState, type RefObject } from 'react';
import type { ScenarioResult } from '../engine/scenario';
import { jobs, money } from './format';

/**
 * On narrow screens the results come after the inputs. This bar keeps the
 * headline values in view while the inputs are on screen, and goes away when
 * the results scroll into the upper half of the screen. Wide screens hide it
 * with CSS.
 */
export function MobileSummary({ result, target, onShow }: {
  result: ScenarioResult | null;
  target: RefObject<HTMLElement>;
  onShow: () => void;
}) {
  const [resultsInView, setResultsInView] = useState(false);
  useEffect(() => {
    const el = target.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setResultsInView(e.isIntersecting), { rootMargin: '0px 0px -50% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [target]);
  if (!result || resultsInView) return null;
  const t = result.totals;
  return (
    <div className="mobile-summary" role="region" aria-label="Summary of results">
      <span className="ms-values">
        <strong>{jobs(t.jobs.total)}</strong> jobs · <strong>{money(t.gdp.total)}</strong> GDP · <strong>{money(result.fiscal.totals.all.total)}</strong> taxes
      </span>
      <button type="button" className="btn primary" onClick={() => {
        onShow();
        const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      }}>
        Show results
      </button>
    </div>
  );
}
