import type { CSSProperties, HTMLAttributes } from 'react';
import styles from './Skeleton.module.scss';

export type SkeletonType =
  | 'text'
  | 'subtitle'
  | 'title'
  | 'picture'
  | 'avatar'
  | 'circle'
  | 'card'
  | 'block'
  | 'code';

interface Props extends HTMLAttributes<HTMLSpanElement> {
  type?: SkeletonType;
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
}

const Skeleton = ({ type = 'block', width, height, className, style, ...rest }: Props) => (
  <span
    className={[styles.root, styles[type], className].filter(Boolean).join(' ')}
    style={{ width, height, ...style }}
    aria-hidden="true"
    {...rest}
  />
);

export default Skeleton;
