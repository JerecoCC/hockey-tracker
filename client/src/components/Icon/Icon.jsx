/**
 * Thin wrapper around Google Material Icons (ligature font).
 * Usage: <Icon name="sports_hockey" />
 *
 * Optional props:
 *   size   – CSS font-size string, e.g. "1.25rem" (default: inherits via global rule)
 *   style  – extra inline styles
 *   className – extra class names
 */
export default function Icon({ name, size, className = '', style = {} }) {
  return (
    <span
      className={`material-icons ${className}`}
      style={size ? { fontSize: size, ...style } : style}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

