import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import cn from 'classnames';
import Select, { SelectOption } from '../Select/Select';
import styles from './Field.module.scss';

type BaseProps = {
  label: string;
  required?: boolean;
};

type TextProps = BaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
    type?: 'text' | 'email' | 'password' | 'number' | 'search' | 'url' | 'tel';
  };

type TextareaProps = BaseProps &
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    type: 'textarea';
  };

type SelectProps = BaseProps & {
  type: 'select';
  value: string | null;
  options: SelectOption[];
  placeholder?: string;
  onChange: (value: string) => void;
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
  if (props.type === 'textarea') {
    const { label, required, type: _t, ...rest } = props;
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
    const { label, required, type: _t, value, options, placeholder, onChange } = props;
    return (
      <div className={styles.label}>
        <LabelText
          label={label}
          required={required}
        />
        <Select
          value={value}
          options={options}
          placeholder={placeholder}
          onChange={onChange}
        />
      </div>
    );
  }

  if (props.type === 'custom') {
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
  const { label, required, ...rest } = props;
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

