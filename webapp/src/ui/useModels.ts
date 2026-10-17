import { useEffect, useState } from 'react';
import type { RegionalModel } from '../engine/io';
import { loadModel, stateByName } from '../engine/data';

/** Regional models for a set of state names, loaded on demand. */
export function useModels(stateNames: string[]): { models: Record<string, RegionalModel>; error: string | null } {
  const [models, setModels] = useState<Record<string, RegionalModel>>({});
  const [error, setError] = useState<string | null>(null);
  const key = [...new Set(stateNames)].sort().join('|');
  useEffect(() => {
    let live = true;
    for (const name of key.split('|').filter(Boolean)) {
      if (models[name]) continue;
      const ref = stateByName(name);
      if (!ref) { setError(`Unknown state: ${name}`); continue; }
      loadModel(ref.abbrev)
        .then((m) => { if (live) setModels((prev) => ({ ...prev, [name]: m })); })
        .catch((e: Error) => { if (live) setError(e.message); });
    }
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { models, error };
}
