import { useNavigate } from 'react-router-dom';
import type { MouseEvent, ReactNode } from 'react';
import Icon from '../Icon/Icon';
import styles from './Breadcrumbs.module.scss';

export interface BreadcrumbItem {
  label: ReactNode;
  /** Shown instead of `label` on mobile (≤ 768 px). Useful for long names like league names. */
  shortLabel?: ReactNode;
  path?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  linkMode?: 'link' | 'button';
}

const renderLabel = (item: BreadcrumbItem) =>
  item.shortLabel ? (
    <>
      <span className={styles.fullLabel}>{item.label}</span>
      <span className={styles.shortLabel}>{item.shortLabel}</span>
    </>
  ) : (
    item.label
  );

const Breadcrumbs = (props: BreadcrumbsProps) => {
  const { items, linkMode = 'link' } = props;
  const navigate = useNavigate();

  const handleLinkClick = (event: MouseEvent<HTMLAnchorElement>, path: string) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }

    event.preventDefault();
    navigate(path);
  };

  const handleButtonClick = (path: string) => {
    navigate(path);
  };

  return (
    <nav
      className={styles.breadcrumbs}
      aria-label="Breadcrumb"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span
            key={index}
            className={styles.item}
          >
            {index > 0 && (
              <Icon
                name="chevron_right"
                className={styles.separator}
              />
            )}
            {!isLast && item.path && linkMode === 'button' ? (
              <button
                type="button"
                className={styles.link}
                onClick={() => handleButtonClick(item.path!)}
              >
                {renderLabel(item)}
              </button>
            ) : !isLast && item.path ? (
              <a
                href={item.path}
                className={styles.link}
                onClick={(event) => handleLinkClick(event, item.path!)}
              >
                {renderLabel(item)}
              </a>
            ) : (
              <span className={isLast ? styles.current : styles.label}>{renderLabel(item)}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
