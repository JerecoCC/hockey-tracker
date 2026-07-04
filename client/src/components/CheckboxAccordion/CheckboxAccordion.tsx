import { useId } from 'react';
import type { ReactNode } from 'react';
import CheckboxField from '@/components/CheckboxField/CheckboxField';
import styles from './CheckboxAccordion.module.scss';

interface CheckboxAccordionProps {
  checked: boolean;
  label: string;
  onChange?: (checked: boolean) => void;
  children: ReactNode;
  className?: string;
  checkboxClassName?: string;
  contentClassName?: string;
  disabled?: boolean;
}

const CheckboxAccordion = ({
  checked,
  label,
  onChange,
  children,
  className,
  checkboxClassName,
  contentClassName,
  disabled = false,
}: CheckboxAccordionProps) => {
  const id = useId();
  const triggerId = `checkbox-accordion-trigger-${id}`;
  const contentId = `checkbox-accordion-content-${id}`;

  return (
    <div className={[styles.checkboxAccordion, className].filter(Boolean).join(' ')}>
      <CheckboxField
        id={triggerId}
        checked={checked}
        label={label}
        onChange={onChange}
        className={[styles.header, checkboxClassName].filter(Boolean).join(' ')}
        disabled={disabled}
        ariaControls={contentId}
        ariaExpanded={checked}
      />
      {checked && (
        <div
          id={contentId}
          role="region"
          aria-labelledby={triggerId}
          className={[styles.content, contentClassName].filter(Boolean).join(' ')}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default CheckboxAccordion;
