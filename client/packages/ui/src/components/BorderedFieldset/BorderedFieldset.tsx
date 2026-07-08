import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import styles from './BorderedFieldset.module.scss';

type BorderedFieldsetProps = ComponentPropsWithoutRef<'fieldset'>;

const BorderedFieldset = forwardRef<HTMLFieldSetElement, BorderedFieldsetProps>(
  ({ className, ...rest }, ref) => (
    <fieldset
      ref={ref}
      className={[styles.borderedFieldset, className].filter(Boolean).join(' ')}
      {...rest}
    />
  ),
);

BorderedFieldset.displayName = 'BorderedFieldset';

export default BorderedFieldset;
