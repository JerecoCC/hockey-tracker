import type { ReactNode } from 'react';
import { Controller, type Control, type FieldValues, type RegisterOptions } from 'react-hook-form';
import {
  ColorPickerField,
  type ColorPickerFieldProps,
  DatePickerField,
  type DatePickerFieldProps,
  InputField,
  type InputFieldProps,
  SelectField,
  type SelectFieldProps,
  TextareaField,
  type TextareaFieldProps,
  TimePickerField,
  type TimePickerFieldProps,
} from '@jerecocc/tracker-ui';
import styles from './ControlledFields.module.scss';

interface ControllerBindingProps {
  control: unknown;
  name: string;
  rules?: RegisterOptions;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

type OptionalLabelProps = {
  hideLabel?: boolean;
  label?: ReactNode;
};

const getLabelProps = (
  label: ReactNode | undefined,
  name: string,
  hideLabel: boolean | undefined,
) => ({
  label: label ?? name,
  hideLabel: hideLabel ?? label == null,
});

export type ControlledInputFieldProps = ControllerBindingProps &
  DistributiveOmit<InputFieldProps, 'label' | 'value' | 'onChange' | 'onBlur' | 'invalid' | 'errorMessage'> &
  OptionalLabelProps & {
    onChange?: InputFieldProps['onChange'];
    onBlur?: InputFieldProps['onBlur'];
  };

export function ControlledInputField({
  control,
  name,
  rules,
  label,
  hideLabel,
  onChange,
  onBlur,
  ...fieldProps
}: ControlledInputFieldProps) {
  return (
    <Controller
      control={control as Control<FieldValues>}
      name={name}
      rules={rules}
      render={({ field, fieldState }) => (
        <InputField
          {...fieldProps}
          {...getLabelProps(label, name, hideLabel)}
          errorMessage={fieldState.error?.message}
          invalid={fieldState.invalid}
          onBlur={(event) => {
            field.onBlur();
            onBlur?.(event);
          }}
          onChange={(value, event) => {
            field.onChange(value);
            onChange?.(value, event);
          }}
          value={field.value ?? ''}
        />
      )}
    />
  );
}

export type ControlledTextareaFieldProps = ControllerBindingProps &
  DistributiveOmit<TextareaFieldProps, 'label' | 'value' | 'onChange' | 'onBlur' | 'invalid' | 'errorMessage'> &
  OptionalLabelProps & {
    onChange?: TextareaFieldProps['onChange'];
    onBlur?: TextareaFieldProps['onBlur'];
  };

export function ControlledTextareaField({
  control,
  name,
  rules,
  label,
  hideLabel,
  onChange,
  onBlur,
  ...fieldProps
}: ControlledTextareaFieldProps) {
  return (
    <Controller
      control={control as Control<FieldValues>}
      name={name}
      rules={rules}
      render={({ field, fieldState }) => (
        <TextareaField
          {...fieldProps}
          {...getLabelProps(label, name, hideLabel)}
          errorMessage={fieldState.error?.message}
          invalid={fieldState.invalid}
          onBlur={(event) => {
            field.onBlur();
            onBlur?.(event);
          }}
          onChange={(value, event) => {
            field.onChange(value);
            onChange?.(value, event);
          }}
          value={field.value ?? ''}
        />
      )}
    />
  );
}

export type ControlledSelectFieldProps = ControllerBindingProps &
  DistributiveOmit<SelectFieldProps, 'label' | 'value' | 'onChange' | 'invalid' | 'errorMessage'> &
  OptionalLabelProps & {
    onChange?: SelectFieldProps['onChange'];
  };

export function ControlledSelectField({
  control,
  name,
  rules,
  label,
  hideLabel,
  onChange,
  ...fieldProps
}: ControlledSelectFieldProps) {
  return (
    <Controller
      control={control as Control<FieldValues>}
      name={name}
      rules={rules}
      render={({ field, fieldState }) => (
        <SelectField
          {...fieldProps}
          {...getLabelProps(label, name, hideLabel)}
          errorMessage={fieldState.error?.message}
          invalid={fieldState.invalid}
          onChange={(value) => {
            field.onChange(value);
            onChange?.(value);
          }}
          value={field.value ?? null}
        />
      )}
    />
  );
}

export type ControlledDatePickerFieldProps = ControllerBindingProps &
  DistributiveOmit<DatePickerFieldProps, 'label' | 'value' | 'onChange' | 'invalid' | 'errorMessage'> &
  OptionalLabelProps;

export function ControlledDatePickerField({
  control,
  name,
  rules,
  label,
  hideLabel,
  ...fieldProps
}: ControlledDatePickerFieldProps) {
  return (
    <Controller
      control={control as Control<FieldValues>}
      name={name}
      rules={rules}
      render={({ field, fieldState }) => (
        <DatePickerField
          {...fieldProps}
          {...getLabelProps(label, name, hideLabel)}
          errorMessage={fieldState.error?.message}
          invalid={fieldState.invalid}
          onChange={field.onChange}
          value={field.value ?? ''}
        />
      )}
    />
  );
}

export type ControlledTimePickerFieldProps = ControllerBindingProps &
  DistributiveOmit<TimePickerFieldProps, 'label' | 'value' | 'onChange' | 'invalid' | 'errorMessage'> &
  OptionalLabelProps;

export function ControlledTimePickerField({
  control,
  name,
  rules,
  label,
  hideLabel,
  ...fieldProps
}: ControlledTimePickerFieldProps) {
  return (
    <Controller
      control={control as Control<FieldValues>}
      name={name}
      rules={rules}
      render={({ field, fieldState }) => (
        <TimePickerField
          {...fieldProps}
          {...getLabelProps(label, name, hideLabel)}
          errorMessage={fieldState.error?.message}
          invalid={fieldState.invalid}
          onChange={field.onChange}
          value={field.value ?? ''}
        />
      )}
    />
  );
}

export type ControlledColorPickerFieldProps = ControllerBindingProps &
  DistributiveOmit<ColorPickerFieldProps, 'label' | 'value' | 'onChange' | 'invalid' | 'errorMessage'> &
  OptionalLabelProps;

export function ControlledColorPickerField({
  control,
  name,
  rules,
  label,
  hideLabel,
  ...fieldProps
}: ControlledColorPickerFieldProps) {
  return (
    <Controller
      control={control as Control<FieldValues>}
      name={name}
      rules={rules}
      render={({ field, fieldState }) => (
        <ColorPickerField
          {...fieldProps}
          {...getLabelProps(label, name, hideLabel)}
          errorMessage={fieldState.error?.message}
          invalid={fieldState.invalid}
          onChange={field.onChange}
          value={field.value ?? '#000000'}
        />
      )}
    />
  );
}

export interface ControlledFieldGroupProps extends ControllerBindingProps {
  children: ReactNode;
  label: ReactNode;
  required?: boolean;
  wrapperClassName?: string;
}

export function ControlledFieldGroup({
  children,
  control,
  label,
  name,
  required,
  rules,
  wrapperClassName,
}: ControlledFieldGroupProps) {
  return (
    <Controller
      control={control as Control<FieldValues>}
      name={name}
      rules={rules}
      render={({ fieldState }) => (
        <div className={wrapperClassName ?? styles.fieldGroup}>
          <span className={styles.label}>
            {label}
            {required && (
              <span
                className={styles.required}
                aria-hidden="true"
              >
                *
              </span>
            )}
          </span>
          {children}
          {fieldState.error?.message && (
            <span
              className={styles.errorMessage}
              role="alert"
            >
              {fieldState.error.message}
            </span>
          )}
        </div>
      )}
    />
  );
}
