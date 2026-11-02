import { useId } from 'react';
import Select, { type SelectOption } from '@jerecocc/tracker-ui/components/Select/Select';
import styles from './FilterSelect.module.scss';

interface FilterSelectProps {
  /** What the select filters, read by screen readers; the selected value shows it on screen. */
  label: string;
  className?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}

/** A filter select labelled for screen readers; its value shows what it filters. */
const FilterSelect = ({ label, className, value, options, onChange }: FilterSelectProps) => {
  const labelId = useId();
  return (
    <div className={className}>
      <span
        id={labelId}
        className={styles.visuallyHidden}
      >
        {label}
      </span>
      <Select
        value={value}
        options={options}
        onChange={onChange}
        ariaLabelledBy={labelId}
        width="full"
      />
    </div>
  );
};

export default FilterSelect;
