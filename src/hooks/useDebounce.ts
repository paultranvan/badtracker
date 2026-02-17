import { useState, useEffect } from 'react';

/**
 * Debounce a value by the specified delay.
 *
 * Returns the latest value only after `delayMs` milliseconds of inactivity.
 * Timer resets on every value change. Cleans up on unmount.
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}
