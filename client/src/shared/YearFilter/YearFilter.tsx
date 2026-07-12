import { useId } from 'react';
import Select, { type SelectOption } from '@jerecocc/tracker-ui/components/Select/Select';
import styles from './YearFilter.module.scss';

interface YearFilterProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}

const YearFilter = ({ value, options, onChange }: YearFilterProps) => {
  const labelId = useId();

  return (
    <div
      className={styles.filter}
      data-year-filter
    >
      <span
        id={labelId}
        className={styles.label}
      >
        Year
      </span>
      <Select
        value={value}
        options={options}
        onChange={onChange}
        ariaLabelledBy={labelId}
        width="content"
      />
    </div>
  );
};

export default YearFilter;
