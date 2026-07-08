import type { ReactNode } from 'react';
import Icon from '../Icon/Icon';
import Tooltip from '../Tooltip/Tooltip';
import styles from './InfoTooltip.module.scss';

interface Props {
  text?: string;
  content?: ReactNode;
  size?: string;
  className?: string;
  ariaLabel?: string;
}

const InfoTooltip = ({
  text,
  content,
  size = '0.95rem',
  className = '',
  ariaLabel,
}: Props) => (
  <Tooltip
    text={text}
    content={content}
  >
    <span
      className={[styles.icon, className].filter(Boolean).join(' ')}
      aria-label={ariaLabel ?? text ?? 'Information'}
      tabIndex={0}
    >
      <Icon
        name="info"
        size={size}
      />
    </span>
  </Tooltip>
);

export default InfoTooltip;
