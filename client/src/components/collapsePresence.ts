import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, TransitionEvent } from 'react';

export const COLLAPSE_ANIMATION_MS = 220;

const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const useCollapsePresence = (
  open: boolean,
  durationMs = COLLAPSE_ANIMATION_MS,
) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const cancelFrameRef = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const hasMountedRef = useRef(false);
  const [shouldRender, setShouldRender] = useState(open);
  const [isOpen, setIsOpen] = useState(open);
  const [height, setHeight] = useState(open ? 'auto' : '0px');

  const clearScheduledWork = useCallback(() => {
    if (typeof window === 'undefined') return;

    if (cancelFrameRef.current != null) {
      cancelFrameRef.current();
      cancelFrameRef.current = null;
    }

    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const scheduleTransitionStep = useCallback((callback: () => void) => {
    if (typeof window === 'undefined') {
      callback();
      return;
    }

    if (typeof window.requestAnimationFrame === 'function') {
      let firstFrame: number | null = null;
      let secondFrame: number | null = null;

      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => {
          cancelFrameRef.current = null;
          callback();
        });
      });

      cancelFrameRef.current = () => {
        if (firstFrame != null) window.cancelAnimationFrame(firstFrame);
        if (secondFrame != null) window.cancelAnimationFrame(secondFrame);
      };
      return;
    }

    const timeout = window.setTimeout(() => {
      cancelFrameRef.current = null;
      callback();
    }, 0);
    cancelFrameRef.current = () => window.clearTimeout(timeout);
  }, []);

  useBrowserLayoutEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      setIsOpen(open);
      setHeight(open ? 'auto' : '0px');
      return undefined;
    }

    clearScheduledWork();

    if (open) {
      if (!shouldRender) {
        setShouldRender(true);
        setIsOpen(false);
        setHeight('0px');
        return undefined;
      }

      const panel = panelRef.current;
      if (!panel) return undefined;

      const currentHeight = panel.getBoundingClientRect().height;
      const targetHeight = panel.scrollHeight;

      setIsOpen(false);
      setHeight(`${currentHeight}px`);
      scheduleTransitionStep(() => {
        setIsOpen(true);
        setHeight(`${targetHeight}px`);
      });
      return clearScheduledWork;
    }

    if (!shouldRender) {
      setIsOpen(false);
      setHeight('0px');
      return undefined;
    }

    const panel = panelRef.current;
    if (!panel) {
      setShouldRender(false);
      return undefined;
    }

    const currentHeight = panel.getBoundingClientRect().height;
    setIsOpen(true);
    setHeight(`${currentHeight}px`);

    scheduleTransitionStep(() => {
      setIsOpen(false);
      setHeight('0px');

      if (typeof window !== 'undefined') {
        timeoutRef.current = window.setTimeout(
          () => setShouldRender(false),
          durationMs + 80,
        );
      }
    });
    return clearScheduledWork;
  }, [clearScheduledWork, durationMs, open, scheduleTransitionStep, shouldRender]);

  useEffect(() => clearScheduledWork, [clearScheduledWork]);

  const handleTransitionEnd = useCallback(
    (event: TransitionEvent<HTMLDivElement>) => {
      if (event.target !== panelRef.current || event.propertyName !== 'height') return;

      clearScheduledWork();
      if (open) {
        setHeight('auto');
      } else {
        setShouldRender(false);
      }
    },
    [clearScheduledWork, open],
  );

  const style: CSSProperties = { height };

  return {
    panelRef,
    shouldRender,
    isOpen,
    style,
    handleTransitionEnd,
  };
};

export default useCollapsePresence;
