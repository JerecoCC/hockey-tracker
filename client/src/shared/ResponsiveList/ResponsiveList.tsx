import type { HTMLAttributes } from 'react';
import styles from './ResponsiveList.module.scss';

export type ResponsiveListProps = HTMLAttributes<HTMLUListElement>;

const ResponsiveList = ({ className, ...rest }: ResponsiveListProps) => (
  <ul
    className={[styles.list, className].filter(Boolean).join(' ')}
    {...rest}
  />
);

export default ResponsiveList;
