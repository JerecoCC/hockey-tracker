import { CSSProperties } from 'react';

/**
 * Thin wrapper around Google Material Icons (ligature font).
 * Usage: <Icon name="sports_hockey" />
 *
 * Optional props:
 *   size   – CSS font-size string, e.g. "1.25rem" (default: inherits via global rule)
 *   style  – extra inline styles
 *   className – extra class names
 */
interface IconProps {
  name: string;
  size?: string;
  className?: string;
  style?: CSSProperties;
}

const Icon = ({ name, size, className = '', style = {} }: IconProps) => {
  return (
    <span
      className={`material-icons ${className}`}
      style={size ? { fontSize: size, ...style } : style}
      aria-hidden="true"
    >
      {name}
    </span>
  );
};

export default Icon;

