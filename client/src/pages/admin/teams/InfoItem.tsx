import type { ReactNode } from 'react';
import Icon from '../../../components/Icon/Icon';
import styles from './InfoItem.module.scss';

type DataProps = {
  label: string;
  type?: 'text' | 'date';
  data: string | null | undefined;
  /** Material icon name rendered inline before the value. */
  icon?: string;
  /** Spans the full grid width. Default: false. */
  full?: boolean;
  /** Fallback text shown when data is empty. Default: '—'. */
  muted?: string;
  children?: never;
};

type HtmlProps = {
  label: string;
  type: 'html';
  /** Raw HTML string to render. */
  data: string | null | undefined;
  full?: boolean;
  /** Fallback text shown when data is empty. Default: '—'. */
  muted?: string;
  icon?: never;
  children?: never;
};

type CustomProps = {
  label: string;
  type: 'custom';
  /** Not required for custom type — use children instead. */
  data?: never;
  full?: boolean;
  muted?: never;
  icon?: never;
  children?: ReactNode;
};

type Props = DataProps | HtmlProps | CustomProps;

const formatDate = (value: string): string => value.split('T')[0].replace(/-/g, '/');

const InfoItem = (props: Props) => {
  const cls = [styles.item, props.full && styles.itemFull].filter(Boolean).join(' ');

  if (props.type === 'custom') {
    return (
      <div className={cls}>
        <span className={styles.label}>{props.label}</span>
        {props.children}
      </div>
    );
  }

  if (props.type === 'html') {
    const { label, data, muted = '—' } = props;
    const hasData = data !== null && data !== undefined && data !== '' && data !== '<p></p>';
    return (
      <div className={cls}>
        <span className={styles.label}>{label}</span>
        {hasData ? (
          <div
            className={styles.htmlContent}
            dangerouslySetInnerHTML={{ __html: data! }}
          />
        ) : (
          <span className={styles.muted}>{muted}</span>
        )}
      </div>
    );
  }

  const { label, data, type = 'text', icon, muted = '—' } = props;
  const hasData = data !== null && data !== undefined && data !== '';

  return (
    <div className={cls}>
      <span className={styles.label}>{label}</span>
      {hasData ? (
        <span className={styles.value}>
          {icon && (
            <Icon
              name={icon}
              size="0.9em"
            />
          )}
          {type === 'date' ? formatDate(data!) : data}
        </span>
      ) : (
        <span className={styles.muted}>{muted}</span>
      )}
    </div>
  );
};

export default InfoItem;
