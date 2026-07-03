import { useId } from 'react';
import type { ReactNode } from 'react';
import CheckboxField from '@/components/CheckboxField/CheckboxField';
import useCollapsePresence from '@/components/collapsePresence';
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
  const {
    panelRef: contentShellRef,
    shouldRender: shouldRenderContent,
    isOpen: contentOpen,
    style: contentStyle,
    handleTransitionEnd: handleContentTransitionEnd,
  } =
    useCollapsePresence(checked);

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
      {shouldRenderContent && (
        <div
          ref={contentShellRef}
          id={contentId}
          role="region"
          aria-labelledby={triggerId}
          className={[
            styles.contentShell,
            contentOpen ? styles.contentShellOpen : styles.contentShellClosed,
          ]
            .filter(Boolean)
            .join(' ')}
          style={contentStyle}
          data-checkbox-accordion-content-shell
          data-state={contentOpen ? 'open' : 'closed'}
          aria-hidden={!checked}
          onTransitionEnd={handleContentTransitionEnd}
        >
          <div className={[styles.content, contentClassName].filter(Boolean).join(' ')}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckboxAccordion;
