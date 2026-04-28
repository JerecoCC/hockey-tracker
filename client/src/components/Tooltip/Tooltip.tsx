import { ReactNode, useRef, useState } from 'react';
import styles from './Tooltip.module.scss';

interface TooltipProps {
  text: string;
  children: ReactNode;
  className?: string;
  /** Visual intent. 'error' renders the tip in danger/red colours. Default: 'default'. */
  intent?: 'default' | 'error';
}

const MARGIN = 8; // min gap from viewport edge (px)
const GAP = 8; // gap between trigger and tip (px)

const Tooltip = (props: TooltipProps) => {
  const { text, children, className = '', intent = 'default' } = props;
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [below, setBelow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [arrowLeft, setArrowLeft] = useState(0);

  const compute = () => {
    const wrapper = wrapperRef.current;
    const tip = tipRef.current;
    if (!wrapper || !tip) return;

    const wRect = wrapper.getBoundingClientRect();
    const tRect = tip.getBoundingClientRect();
    const center = wRect.left + wRect.width / 2;

    // Vertical: flip below when not enough room above
    const placeBelow = wRect.top - tRect.height - GAP < MARGIN;
    setBelow(placeBelow);

    const top = placeBelow ? wRect.bottom + GAP : wRect.top - tRect.height - GAP;

    // Horizontal: center on trigger, clamp to viewport
    const left = Math.max(
      MARGIN,
      Math.min(center - tRect.width / 2, window.innerWidth - tRect.width - MARGIN),
    );

    // Arrow: px offset from left edge of bubble so it stays over the trigger
    setArrowLeft(center - left);
    setPos({ top, left });
  };

  const show = () => {
    setVisible(true);
    requestAnimationFrame(compute);
  };

  const hide = () => {
    setVisible(false);
    setBelow(false);
  };

  const tipClass = [
    styles.tip,
    visible && styles.tipVisible,
    below && styles.tipBelow,
    intent === 'error' && styles.tipError,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      ref={wrapperRef}
      className={`${styles.wrapper} ${className}`.trim()}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      <span
        ref={tipRef}
        className={tipClass}
        role="tooltip"
        style={
          {
            top: pos.top,
            left: pos.left,
            '--arrow-left': `${arrowLeft}px`,
          } as React.CSSProperties
        }
      >
        {text}
      </span>
    </span>
  );
};

export default Tooltip;
