import { useCallback, useEffect, useState } from 'react';

/**
 * 비동기 service 호출용 공통 hook.
 * const { data, loading, error, reload } = useAsync(() => curationService.getCuration(), []);
 */
export function useAsync(asyncFn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const run = useCallback(asyncFn, deps);

  const load = useCallback(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    run()
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ data: null, loading: false, error }));
    return () => {
      cancelled = true;
    };
  }, [run]);

  useEffect(() => load(), [load]);

  return { ...state, reload: load };
}
