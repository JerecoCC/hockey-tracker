import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import BaseSection from '@jerecocc/tracker-ui/components/Section/Section';
import styles from './Section.module.scss';

type SectionProps = ComponentPropsWithoutRef<typeof BaseSection>;

const Section = forwardRef<ElementRef<typeof BaseSection>, SectionProps>(
  ({ className, ...props }, ref) => (
    <BaseSection
      ref={ref}
      className={[styles.sectionRoot, className].filter(Boolean).join(' ')}
      {...props}
    />
  ),
);

Section.displayName = 'Section';

export default Section;
export * from '@jerecocc/tracker-ui/components/Section/Section';
