import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import BorderedFieldset from '../BorderedFieldset/BorderedFieldset';
import styles from './GroupedFields.module.scss';

interface GroupedFieldsProps extends Omit<ComponentPropsWithoutRef<'fieldset'>, 'children'> {
  legend?: ReactNode;
  children: ReactNode;
  legendClassName?: string;
  fieldsClassName?: string;
  variant?: 'bordered' | 'plain';
}

const GroupedFields = forwardRef<HTMLFieldSetElement, GroupedFieldsProps>(
  (
    {
      legend,
      children,
      className,
      legendClassName,
      fieldsClassName,
      variant = 'bordered',
      ...rest
    },
    ref,
  ) => (
    <BorderedFieldset
      ref={ref}
      className={[styles.groupedFields, variant === 'plain' ? styles.plain : '', className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {legend != null && (
        <legend className={[styles.legend, legendClassName].filter(Boolean).join(' ')}>
          {legend}
        </legend>
      )}
      <div className={[styles.fields, fieldsClassName].filter(Boolean).join(' ')}>
        {children}
      </div>
    </BorderedFieldset>
  ),
);

GroupedFields.displayName = 'GroupedFields';

export default GroupedFields;
