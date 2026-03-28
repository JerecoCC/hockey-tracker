import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { Controller, type Control, type RegisterOptions } from 'react-hook-form';
import cn from 'classnames';
import Select, { SelectOption } from '../Select/Select';
import styles from './Field.module.scss';

type BaseProps = {
  label: string;
  required?: boolean;
  // typed as unknown so any Control<TFieldValues> can be passed without variance errors
  control?: unknown;
  rules?: RegisterOptions;
};

type TextProps = BaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
    type?: 'text' | 'email' | 'password' | 'number' | 'search' | 'url' | 'tel';
    transform?: (value: string) => string;
  };

type TextareaProps = BaseProps &
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    type: 'textarea';
    transform?: (value: string) => string;
  };

type SelectProps = BaseProps & {
  type: 'select';
  name?: string;
  value?: string | null;
  options: SelectOption[];
  placeholder?: string;
  onChange?: (value: string) => void;
};

type CustomProps = BaseProps & {
  type: 'custom';
  children: ReactNode;
};

export type FieldProps = TextProps | TextareaProps | SelectProps | CustomProps;

const LabelText = ({ label, required }: { label: string; required?: boolean }) => (
  <span className={styles.labelText}>
    {label}
    {required && <span className={styles.required}>*</span>}
  </span>
);

const Field = (props: FieldProps) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctrl = props.control as Control<any> | undefined;

  if (props.type === 'textarea') {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { label, required, type: _t, control: _c, rules, transform, ...rest } = props;
    if (ctrl && rest.name) {
      return (
        <Controller
          control={ctrl}
          name={rest.name}
          rules={rules}
          render={({ field }) => (
            <label className={styles.label}>
              <LabelText
                label={label}
                required={required}
              />
              <textarea
                className={cn(styles.field, styles.textarea)}
                required={required}
                {...rest}
                value={(field.value as string) ?? ''}
                onChange={
                  transform
                    ? (e) => field.onChange(transform(e.target.value))
                    : (e) => field.onChange(e.target.value)
                }
                onBlur={field.onBlur}
              />
            </label>
          )}
        />
      );
    }
    return (
      <label className={styles.label}>
        <LabelText
          label={label}
          required={required}
        />
        <textarea
          className={cn(styles.field, styles.textarea)}
          required={required}
          {...rest}
        />
      </label>
    );
  }

  if (props.type === 'select') {
    const {
      label,
      required,
      type: _t,
      control: _c,
      rules,
      name,
      value,
      options,
      placeholder,
      onChange,
    } = props;
    if (ctrl && name) {
      return (
        <Controller
          control={ctrl}
          name={name}
          rules={rules}
          render={({ field }) => (
            <div className={styles.label}>
              <LabelText
                label={label}
                required={required}
              />
              <Select
                value={field.value as string | null}
                options={options}
                placeholder={placeholder}
                onChange={field.onChange}
              />
            </div>
          )}
        />
      );
    }
    return (
      <div className={styles.label}>
        <LabelText
          label={label}
          required={required}
        />
        <Select
          value={value ?? null}
          options={options}
          placeholder={placeholder}
          onChange={onChange!}
        />
      </div>
    );
  }

  if (props.type === 'custom') {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { label, required, type: _t, children } = props;
    return (
      <div className={styles.label}>
        <LabelText
          label={label}
          required={required}
        />
        {children}
      </div>
    );
  }

  // Default: text input
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { label, required, control: _c, rules, transform, ...rest } = props as TextProps;
  if (ctrl && rest.name) {
    return (
      <Controller
        control={ctrl}
        name={rest.name}
        rules={rules}
        render={({ field }) => (
          <label className={styles.label}>
            <LabelText
              label={label}
              required={required}
            />
            <input
              className={styles.field}
              required={required}
              {...rest}
              value={(field.value as string) ?? ''}
              onChange={
                transform ? (e) => field.onChange(transform(e.target.value)) : field.onChange
              }
              onBlur={field.onBlur}
            />
          </label>
        )}
      />
    );
  }
  return (
    <label className={styles.label}>
      <LabelText
        label={label}
        required={required}
      />
      <input
        className={styles.field}
        required={required}
        {...rest}
      />
    </label>
  );
};

export default Field;
