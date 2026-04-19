import { useNavigate } from 'react-router-dom';
import Icon from '../Icon/Icon';
import styles from './Breadcrumbs.module.scss';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

const Breadcrumbs = (props: BreadcrumbsProps) => {
  const { items } = props;
  const navigate = useNavigate();

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
            {!isLast && item.path ? (
              <button
                className={styles.link}
                onClick={() => navigate(item.path!)}
              >
                {item.label}
              </button>
            ) : (
              <span className={isLast ? styles.current : styles.label}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
