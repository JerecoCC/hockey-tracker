import type { ChangeEvent, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { Controller, type Control, type RegisterOptions } from 'react-hook-form';
import cn from 'classnames';
import DatePicker from '../DatePicker/DatePicker';
import Select, { SelectOption } from '../Select/Select';
import styles from './Field.module.scss';

type BaseProps = {
  label: string;
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
};

type CustomProps = BaseProps & {
  type: 'custom';
  children: ReactNode;
};

type DatePickerProps = BaseProps & {
  type: 'datepicker';
  placeholder?: string;
};

export type FieldProps = TextProps | TextareaProps | SelectProps | CustomProps | DatePickerProps;

const Field = (props: FieldProps) => {
  const { label, required, control, name, rules } = props;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctrl = control as Control<any>;

  return (
    <Controller
      control={ctrl}
      name={name}
      rules={rules}
      render={({ field }) => {
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
                className={cn(styles.field, styles.textarea)}
                required={required}
                {...rest}
                value={(field.value as string) ?? ''}
                onChange={onChange}
                onBlur={field.onBlur}
              />
            );
          } else if (props.type === 'select') {
            const { options, placeholder, disabled } = props;
            return (
              <Select
                value={(field.value as string) ?? null}
                options={options}
                placeholder={placeholder}
                onChange={field.onChange}
                disabled={disabled}
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
          } else {
            /* eslint-disable @typescript-eslint/no-unused-vars */
            const {
              label: _l,
              required: _r,
              control: _c,
              name: _n,
              rules: _ru,
              transform,
              ...rest
            } = props;
            /* eslint-enable @typescript-eslint/no-unused-vars */
            const onChange = transform
              ? (e: ChangeEvent<HTMLInputElement>) => field.onChange(transform(e.target.value))
              : field.onChange;
            return (
              <input
                className={styles.field}
                required={required}
                {...rest}
                value={(field.value as string) ?? ''}
                onChange={onChange}
                onBlur={field.onBlur}
              />
            );
          }
        };

        return (
          <label className={styles.label}>
            <span className={styles.labelText}>
              {label}
              {required && <span className={styles.required}>*</span>}
            </span>
            {getField()}
          </label>
        );
      }}
    />
  );
};

export default Field;
