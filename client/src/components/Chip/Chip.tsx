import type { ReactNode } from 'react';
import { mixWithWhite } from '@/lib/color';
import styles from './Chip.module.scss';

export type ChipSize = 'small' | 'medium';

export interface ChipProps {
  children: ReactNode;
  size?: ChipSize;
  primaryColor?: string | null;
  textColor?: string | null;
  className?: string;
}

const Chip = ({ children, size = 'medium', primaryColor, textColor, className }: ChipProps) => (
  <span
    className={[styles.chip, size === 'small' ? styles.small : '', className]
      .filter(Boolean)
      .join(' ')}
    style={
      primaryColor
        ? {
            background: mixWithWhite(primaryColor, 0.2),
            borderColor: primaryColor,
            color: textColor ?? undefined,
          }
        : undefined
    }
  >
    {children}
  </span>
);

export default Chip;
