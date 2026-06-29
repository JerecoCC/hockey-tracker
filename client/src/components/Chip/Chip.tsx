import type { ReactNode } from 'react';
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
            background: primaryColor,
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
