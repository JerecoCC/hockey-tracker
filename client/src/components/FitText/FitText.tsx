import {
  createElement,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import styles from './FitText.module.scss';

type FitTextTag = 'span' | 'strong' | 'div';

interface FitTextProps extends HTMLAttributes<HTMLElement> {
  as?: FitTextTag;
  children: ReactNode;
  minFontSize?: number;
  maxFontSize?: number;
}

const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const FitText = ({
  as = 'span',
  children,
  className,
  minFontSize = 10,
  maxFontSize,
  style,
  ...rest
}: FitTextProps) => {
  const ref = useRef<HTMLElement | null>(null);
  const [fontSize, setFontSize] = useState<number | null>(null);

  const measure = useCallback(() => {
    const node = ref.current;
    if (!node || typeof window === 'undefined') return;

    const computed = window.getComputedStyle(node);
    const baseFontSize = maxFontSize ?? Number.parseFloat(computed.fontSize);
    if (!Number.isFinite(baseFontSize) || baseFontSize <= 0) return;

    const previousFontSize = node.style.fontSize;
    node.style.fontSize = `${baseFontSize}px`;

    const availableWidth = node.clientWidth;
    const neededWidth = node.scrollWidth;

    node.style.fontSize = previousFontSize;

    if (availableWidth <= 0 || neededWidth <= 0 || neededWidth <= availableWidth) {
      setFontSize(null);
      return;
    }

    const nextFontSize = Math.max(
      minFontSize,
      Math.floor((baseFontSize * availableWidth) / neededWidth),
    );
    setFontSize((current) => (current === nextFontSize ? current : nextFontSize));
  }, [maxFontSize, minFontSize]);

  useBrowserLayoutEffect(() => {
    measure();
  }, [children, measure]);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [measure]);

  useEffect(() => {
    const fontsReady = document.fonts?.ready;
    if (!fontsReady) return undefined;

    let active = true;
    fontsReady.then(() => {
      if (active) measure();
    });
    return () => {
      active = false;
    };
  }, [measure]);

  const mergedStyle: CSSProperties | undefined =
    fontSize == null ? style : { ...style, fontSize: `${fontSize}px` };
  const mergedClassName = [styles.fitText, className].filter(Boolean).join(' ');

  return createElement(
    as,
    {
      ...rest,
      ref,
      className: mergedClassName,
      style: mergedStyle,
    },
    children,
  );
};

export default FitText;
