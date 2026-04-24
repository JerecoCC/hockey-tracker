import {
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { Controller, type Control, type RegisterOptions } from 'react-hook-form';
import Icon from '../Icon/Icon';
import cn from 'classnames';
import DatePicker from '../DatePicker/DatePicker';
import RichTextEditor from '../RichTextEditor/RichTextEditor';
import Select, { SelectOption } from '../Select/Select';
import styles from './Field.module.scss';

type BaseProps = {
  label?: string;
  required?: boolean;
  // typed as unknown so any Control<TFieldValues> can be passed without variance errors
  control: unknown;
  name: string;
  rules?: RegisterOptions;
};

type TextProps = BaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'name'> & {
    type?: 'text' | 'email' | 'password' | 'number' | 'search' | 'url' | 'tel' | 'date';
    transform?: (value: string) => string;
    /** Short unit label rendered inside the input on the right (e.g. "ft", "lbs"). */
    suffix?: string;
  };

type TextareaProps = BaseProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'name'> & {
    type: 'textarea';
    transform?: (value: string) => string;
  };

type SelectProps = BaseProps & {
  type: 'select';
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Called with the new value whenever the user picks an option (fires synchronously, alongside field.onChange). */
  onChange?: (value: string | null) => void;
};

type CustomProps = BaseProps & {
  type: 'custom';
  children: ReactNode;
};

type DatePickerProps = BaseProps & {
  type: 'datepicker';
  placeholder?: string;
};

type ColorProps = BaseProps & {
  type: 'color';
};

type RichTextProps = BaseProps & {
  type: 'richtext';
  disabled?: boolean;
};

export type FieldProps =
  | TextProps
  | TextareaProps
  | SelectProps
  | CustomProps
  | DatePickerProps
  | ColorProps
  | RichTextProps;

const Field = (props: FieldProps) => {
  const { label, required, control, name, rules } = props;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctrl = control as Control<any>;
  const [showPassword, setShowPassword] = useState(false);
  const colorPickerRef = useRef<HTMLInputElement>(null);

  return (
    <Controller
      control={ctrl}
      name={name}
      rules={rules}
      render={({ field, fieldState }) => {
        const hasError = !!fieldState.error;
        const getField = () => {
          if (props.type === 'textarea') {
            /* eslint-disable @typescript-eslint/no-unused-vars */
            const {
              label: _l,
              required: _r,
              control: _c,
              name: _n,
              rules: _ru,
              type: _t,
              transform,
              ...rest
            } = props;
            /* eslint-enable @typescript-eslint/no-unused-vars */
            const onChange = transform
              ? (e: ChangeEvent<HTMLTextAreaElement>) => field.onChange(transform(e.target.value))
              : (e: ChangeEvent<HTMLTextAreaElement>) => field.onChange(e.target.value);
            return (
              <textarea
                className={cn(styles.field, styles.textarea, hasError && styles.fieldError)}
                required={required}
                {...rest}
                value={(field.value as string) ?? ''}
                onChange={onChange}
                onBlur={field.onBlur}
              />
            );
          } else if (props.type === 'select') {
            const { options, placeholder, disabled, onChange: onChangeProp } = props;
            return (
              <Select
                value={(field.value as string) ?? null}
                options={options}
                placeholder={placeholder}
                onChange={(val) => {
                  field.onChange(val);
                  onChangeProp?.(val);
                }}
                disabled={disabled}
                error={hasError}
              />
            );
          } else if (props.type === 'custom') {
            return props.children;
          } else if (props.type === 'datepicker') {
            return (
              <DatePicker
                value={(field.value as string) ?? ''}
                onChange={field.onChange}
                placeholder={props.placeholder}
              />
            );
          } else if (props.type === 'richtext') {
            return (
              <RichTextEditor
                content={(field.value as string) ?? ''}
                onChange={field.onChange}
                autoFocus={false}
                editable={!props.disabled}
              />
            );
          } else if (props.type === 'color') {
            const color = (field.value as string) ?? '#000000';
            return (
              <div className={styles.colorInputWrapper}>
                <button
                  type="button"
                  className={styles.colorSwatch}
                  style={{ background: color }}
                  onClick={() => colorPickerRef.current?.click()}
                />
                <input
                  ref={colorPickerRef}
                  type="color"
                  value={color}
                  onChange={(e) => field.onChange(e.target.value)}
                  className={styles.colorHiddenInput}
                  tabIndex={-1}
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                  className={styles.colorHexInput}
                  spellCheck={false}
                  maxLength={7}
                />
              </div>
            );
          } else {
            /* eslint-disable @typescript-eslint/no-unused-vars */
            const {
              label: _l,
              required: _r,
              control: _c,
              name: _n,
              rules: _ru,
              transform,
              suffix,
              ...rest
            } = props;
            /* eslint-enable @typescript-eslint/no-unused-vars */
            const onChange = transform
              ? (e: ChangeEvent<HTMLInputElement>) => field.onChange(transform(e.target.value))
              : field.onChange;
            const isPassword = props.type === 'password';
            const hasSuffix = !isPassword && !!suffix;
            const input = (
              <input
                className={cn(
                  styles.field,
                  hasSuffix && styles.fieldWithSuffix,
                  hasError && styles.fieldError,
                )}
                required={required}
                {...rest}
                type={isPassword ? (showPassword ? 'text' : 'password') : rest.type}
                value={(field.value as string) ?? ''}
                onChange={onChange}
                onBlur={field.onBlur}
              />
            );
            if (!isPassword && !hasSuffix) return input;
            if (isPassword) {
              return (
                <div className={styles.inputWrapper}>
                  {input}
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Icon name={showPassword ? 'visibility_off' : 'visibility'} />
                  </button>
                </div>
              );
            }
            return (
              <div className={styles.inputWrapper}>
                {input}
                <span className={styles.inputSuffix}>{suffix}</span>
              </div>
            );
          }
        };

        return (
          <label className={styles.label}>
            {label && (
              <span className={styles.labelText}>
                {label}
                {required && <span className={styles.required}>*</span>}
              </span>
            )}
            {getField()}
          </label>
        );
      }}
    />
  );
};

export default Field;
