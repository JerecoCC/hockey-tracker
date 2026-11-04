import { useId } from 'react';
import MultiSelect, {
  type MultiSelectOption,
} from '@jerecocc/tracker-ui/components/MultiSelect/MultiSelect';
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

interface FilterMultiSelectProps {
  /** What the select filters, read by screen readers; the placeholder shows it on screen. */
  label: string;
  className?: string;
  value: string[];
  options: MultiSelectOption[];
  placeholder: string;
  emptyMessage?: string;
  /** Lets long option lists be searched by typing. */
  searchable?: boolean;
  onChange: (values: string[]) => void;
}

/** A multi-select filter labelled for screen readers; selecting nothing filters nothing. */
export const FilterMultiSelect = ({
  label,
  className,
  value,
  options,
  placeholder,
  emptyMessage,
  searchable = false,
  onChange,
}: FilterMultiSelectProps) => {
  const labelId = useId();
  return (
    <div className={[styles.multiSelect, className].filter(Boolean).join(' ')}>
      <span
        id={labelId}
        className={styles.visuallyHidden}
      >
        {label}
      </span>
      <MultiSelect
        value={value}
        options={options}
        placeholder={placeholder}
        emptyMessage={emptyMessage}
        onChange={onChange}
        ariaLabelledBy={labelId}
        selectionLayout="wrap"
        searchable={searchable}
      />
    </div>
  );
};

export default FilterSelect;
