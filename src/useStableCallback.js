import { useRef, useCallback, useEffect } from "react";

// A callback that always closes over the latest data but keeps the same
// identity and will not be called after component unmounts

const useStableCallback = callback => {
  const callbackRef = useRef();
  const memoCallback = useCallback(
    (...args) => callbackRef.current && callbackRef.current(...args),
    []
  );
  useEffect(() => {
    callbackRef.current = callback;
    return () => (callbackRef.current = undefined);
  });
  return memoCallback;
};

export default useStableCallback;
