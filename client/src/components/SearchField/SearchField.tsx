import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type ChangeEvent,
  type InputHTMLAttributes,
} from 'react';
import cn from 'classnames';
import Icon from '../Icon/Icon';
import Divider from '../Divider/Divider';
import styles from './SearchField.module.scss';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: string;
  onChange: (value: string, event?: ChangeEvent<HTMLInputElement>) => void;
  inputClassName?: string;
  iconClassName?: string;
  clearClassName?: string;
  clearLabel?: string;
  error?: boolean;
};

const SearchField = forwardRef<HTMLInputElement, Props>(
  (
    {
      value,
      onChange,
      className,
      inputClassName,
      iconClassName,
      clearClassName,
      clearLabel = 'Clear search',
      error,
      disabled,
      readOnly,
      ...rest
    },
    ref,
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const canClear = value.length > 0 && !disabled && !readOnly;

    return (
      <div
        className={cn(
          styles.searchField,
          error && styles.error,
          disabled && styles.disabled,
          className,
        )}
      >
        <span
          className={styles.iconRegion}
          aria-hidden="true"
        >
          <Icon
            name="search"
            size="1em"
            className={cn(styles.icon, iconClassName)}
          />
        </span>
        <Divider
          variant="vertical"
          className={styles.divider}
        />
        <input
          ref={inputRef}
          className={cn(styles.input, inputClassName)}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value, event)}
          disabled={disabled}
          readOnly={readOnly}
          {...rest}
        />
        {canClear && (
          <button
            type="button"
            className={cn(styles.clear, clearClassName)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange('');
              inputRef.current?.focus();
            }}
            aria-label={clearLabel}
          >
            <Icon
              name="close"
              size="0.8em"
            />
          </button>
        )}
      </div>
    );
  },
);

SearchField.displayName = 'SearchField';

export default SearchField;
