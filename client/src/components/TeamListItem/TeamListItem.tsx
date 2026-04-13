import type { ReactNode } from 'react';
import ActionOverlay from '../ActionOverlay/ActionOverlay';
import styles from './TeamListItem.module.scss';

interface Props {
  logo?: string | null;
  name: string;
  code?: string | null;
  /** Optional secondary line shown below the name (e.g. season label + recorded date). */
  subtitle?: string;
  /** Optional third line shown below the subtitle (e.g. a version note). */
  note?: string;
  /** Hover-revealed action buttons. */
  actions?: ReactNode;
  className?: string;
}

const TeamListItem = ({ logo, name, code, subtitle, note, actions, className }: Props) => {
  const hasExtra = !!subtitle || !!note;

  return (
    <li className={[styles.item, className].filter(Boolean).join(' ')}>
      {/* Logo or code placeholder */}
      {logo ? (
        <img
          src={logo}
          alt=""
          className={styles.logo}
        />
      ) : (
        <span className={styles.logoPlaceholder}>{(code ?? name).slice(0, 3)}</span>
      )}

      {/* Info column — always rendered so flex:1 pushes code/actions right */}
      <div className={styles.info}>
        <span className={styles.name}>{name}</span>
        {hasExtra && (
          <>
            {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
            {note && <span className={styles.note}>{note}</span>}
          </>
        )}
      </div>

      {/* Code */}
      {code && <span className={styles.code}>{code}</span>}

      {/* Actions (fade in on hover via ActionOverlay) */}
      {actions && <ActionOverlay className={styles.actions}>{actions}</ActionOverlay>}
    </li>
  );
};

export default TeamListItem;
