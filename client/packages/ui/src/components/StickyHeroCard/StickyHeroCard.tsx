import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ForwardedRef,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import Card from '../Card/Card';
import styles from './StickyHeroCard.module.scss';

const DEFAULT_STICKY_TOP_PX = 52;
const MOBILE_BREAKPOINT_PX = 768;

type StickyHeroCardRenderProps = {
  isStuck: boolean;
};

interface StickyHeroCardProps extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  variant?: 'filled' | 'border' | 'light';
  className?: string;
  stuckClassName?: string;
  stickyTopPx?: number;
  expandOnStuck?: boolean;
  children: ReactNode | ((props: StickyHeroCardRenderProps) => ReactNode);
}

const getScrollParent = (el: HTMLElement): HTMLElement => {
  let parent = el.parentElement;
  while (parent) {
    const { overflowY } = window.getComputedStyle(parent);
    if (overflowY === 'auto' || overflowY === 'scroll') return parent;
    parent = parent.parentElement;
  }
  return document.documentElement;
};

const mergeRefs =
  (localRef: MutableRefObject<HTMLDivElement | null>, forwardedRef: ForwardedRef<HTMLDivElement>) =>
  (node: HTMLDivElement | null) => {
    localRef.current = node;
    if (typeof forwardedRef === 'function') {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }
  };

const StickyHeroCard = forwardRef<HTMLDivElement, StickyHeroCardProps>((props, ref) => {
  const {
    variant = 'filled',
    className,
    stuckClassName,
    stickyTopPx = DEFAULT_STICKY_TOP_PX,
    expandOnStuck = true,
    children,
    style,
    ...rest
  } = props;
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [isStuck, setIsStuck] = useState(false);

  const checkStuck = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;

    const nextIsStuck =
      window.innerWidth > MOBILE_BREAKPOINT_PX &&
      card.getBoundingClientRect().top <= stickyTopPx;

    setIsStuck((current) => (current === nextIsStuck ? current : nextIsStuck));
  }, [stickyTopPx]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const scrollEl = getScrollParent(card);
    scrollEl.addEventListener('scroll', checkStuck, { passive: true });
    window.addEventListener('resize', checkStuck, { passive: true });
    checkStuck();

    return () => {
      scrollEl.removeEventListener('scroll', checkStuck);
      window.removeEventListener('resize', checkStuck);
    };
  }, [checkStuck]);

  const cardClassName = [
    styles.card,
    expandOnStuck && styles.expandOnStuck,
    className,
    isStuck && styles.stuck,
    isStuck && stuckClassName,
  ]
    .filter(Boolean)
    .join(' ');
  const cardStyle = {
    '--sticky-hero-top': `${stickyTopPx}px`,
    ...style,
  } as CSSProperties;

  return (
    <Card
      ref={mergeRefs(cardRef, ref)}
      variant={variant}
      className={cardClassName}
      style={cardStyle}
      data-stuck={isStuck ? 'true' : 'false'}
      {...rest}
    >
      {typeof children === 'function' ? children({ isStuck }) : children}
    </Card>
  );
});

StickyHeroCard.displayName = 'StickyHeroCard';

export default StickyHeroCard;
