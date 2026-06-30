import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import BorderedFieldset from '@/components/BorderedFieldset/BorderedFieldset';
import styles from './GroupedFields.module.scss';

interface GroupedFieldsProps extends Omit<ComponentPropsWithoutRef<'fieldset'>, 'children'> {
  legend: ReactNode;
  children: ReactNode;
  legendClassName?: string;
  fieldsClassName?: string;
}

const GroupedFields = forwardRef<HTMLFieldSetElement, GroupedFieldsProps>(
  ({ legend, children, className, legendClassName, fieldsClassName, ...rest }, ref) => (
    <BorderedFieldset
      ref={ref}
      className={[styles.groupedFields, className].filter(Boolean).join(' ')}
      {...rest}
    >
      <legend className={[styles.legend, legendClassName].filter(Boolean).join(' ')}>
        {legend}
      </legend>
      <div className={[styles.fields, fieldsClassName].filter(Boolean).join(' ')}>
        {children}
      </div>
    </BorderedFieldset>
  ),
);

GroupedFields.displayName = 'GroupedFields';

export default GroupedFields;
