import type { CSSProperties, ElementType, HTMLAttributes } from 'react';
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
  | 'code'
  | 'tag';

interface Props extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  type?: SkeletonType;
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
}

const Skeleton = ({
  as: Component = 'span',
  type = 'block',
  width,
  height,
  className,
  style,
  ...rest
}: Props) => (
  <Component
    className={[styles.root, styles[type], className].filter(Boolean).join(' ')}
    style={{ width, height, ...style }}
    aria-hidden="true"
    {...rest}
  />
);

export default Skeleton;
