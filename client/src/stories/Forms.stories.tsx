import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import CheckboxField from '@jerecocc/tracker-ui/components/CheckboxField/CheckboxField';
import DatePicker from '@jerecocc/tracker-ui/components/DatePicker/DatePicker';
import DescriptionEditor from '@jerecocc/tracker-ui/components/DescriptionEditor/DescriptionEditor';
import LogoUpload from '@jerecocc/tracker-ui/components/LogoUpload/LogoUpload';
import MultiSelect, {
  type MultiSelectOption,
} from '@jerecocc/tracker-ui/components/MultiSelect/MultiSelect';
import PeriodPicker from '@jerecocc/tracker-ui/components/PeriodPicker/PeriodPicker';
import RichTextEditor from '@jerecocc/tracker-ui/components/RichTextEditor/RichTextEditor';
import { SearchInput } from '@jerecocc/tracker-ui';
import SeasonSelect from '@/shared/SeasonSelect/SeasonSelect';
import SegmentedControl from '@jerecocc/tracker-ui/components/SegmentedControl/SegmentedControl';
import Select, { type SelectOption } from '@jerecocc/tracker-ui/components/Select/Select';
import TimePicker from '@jerecocc/tracker-ui/components/TimePicker/TimePicker';
import {
  FormFieldDemo,
  minLogo,
  Stateful,
  StoryGrid,
  StoryPage,
  StoryPanel,
  StorySection,
  vicLogo,
} from './storyData';

const meta = {
  title: 'Shared Components/Forms',
  parameters: {
    docs: {
      description: {
        component: 'Controlled inputs, pickers, uploaders, search, and rich text editing.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const teamOptions: SelectOption[] = [
  { value: 'mtl', label: 'Montreal Victoire', logo: vicLogo, code: 'MTL' },
  { value: 'min', label: 'Minnesota Frost', logo: minLogo, code: 'MIN' },
  { divider: true },
  { value: 'bos', label: 'Boston Fleet', code: 'BOS' },
];

const multiTeamOptions: MultiSelectOption[] = [
  { value: 'mtl', label: 'Montreal Victoire', logo: vicLogo, code: 'MTL' },
  { value: 'min', label: 'Minnesota Frost', logo: minLogo, code: 'MIN' },
  { value: 'bos', label: 'Boston Fleet', code: 'BOS' },
];

const seasons = [
  { id: 'season-3', name: '2025-26', start_date: '2025-11-01', is_current: true },
  { id: 'season-2', name: '2024-25', start_date: '2024-11-01' },
  { id: 'season-1', name: '2023-24', start_date: '2023-11-01' },
];

const LogoUploadDemo = () => {
  const form = useForm({ defaultValues: { logo: null as File | string | null } });
  return (
    <LogoUpload
      control={form.control}
      name="logo"
      label="Team Logo"
      hint="Browse, paste, or clear the preview"
    />
  );
};

const RichTextDemo = () => {
  const [content, setContent] = useState(
    '<p><strong>Bold scouting note</strong> with context.</p>',
  );
  return (
    <RichTextEditor
      content={content}
      onChange={setContent}
      autoFocus={false}
    />
  );
};

export const FieldGallery = {
  render: () => (
    <StoryPage>
      <StorySection title="Field">
        <StoryPanel>
          <FormFieldDemo />
        </StoryPanel>
      </StorySection>
      <StorySection title="Standalone controls">
        <StoryGrid>
          <StoryPanel>
            <Stateful initial="mtl">
              {(value, setValue) => (
                <Select
                  value={value}
                  options={teamOptions}
                  onChange={setValue}
                  searchable
                />
              )}
            </Stateful>
            <Stateful initial={['mtl', 'min']}>
              {(value, setValue) => (
                <MultiSelect
                  value={value}
                  options={multiTeamOptions}
                  selectionLayout="wrap"
                  onChange={setValue}
                  searchable
                />
              )}
            </Stateful>
            <Stateful initial={true}>
              {(checked, setChecked) => (
                <CheckboxField
                  checked={checked}
                  label="Lock until playoffs start"
                  onCheckedChange={setChecked}
                />
              )}
            </Stateful>
          </StoryPanel>
          <StoryPanel>
            <Stateful initial="2026-01-18">
              {(value, setValue) => (
                <DatePicker
                  value={value}
                  onChange={setValue}
                />
              )}
            </Stateful>
            <Stateful initial="19:30">
              {(value, setValue) => (
                <TimePicker
                  value={value}
                  onChange={setValue}
                />
              )}
            </Stateful>
            <Stateful initial="12:45">
              {(value, setValue) => (
                <TimePicker
                  value={value}
                  onChange={setValue}
                  mode="duration"
                />
              )}
            </Stateful>
          </StoryPanel>
          <StoryPanel>
            <Stateful initial="2026-01-18">
              {(value, setValue) => (
                <PeriodPicker
                  value={value}
                  onChange={setValue}
                  onPrevious={() => setValue('2026-01-11')}
                  onNext={() => setValue('2026-01-25')}
                />
              )}
            </Stateful>
            <Stateful initial="2026-01">
              {(value, setValue) => (
                <PeriodPicker
                  kind="month"
                  value={value}
                  onChange={setValue}
                  onPrevious={() => setValue('2025-12')}
                  onNext={() => setValue('2026-02')}
                />
              )}
            </Stateful>
          </StoryPanel>
        </StoryGrid>
      </StorySection>
    </StoryPage>
  ),
} satisfies Story;

export const SearchAndSelection = {
  render: () => (
    <StoryGrid>
      <StoryPanel>
        <Stateful initial="Taylor">
          {(value, setValue) => (
            <SearchInput
              value={value}
              onChange={setValue}
              placeholder="Search players..."
            />
          )}
        </Stateful>
      </StoryPanel>
      <StoryPanel>
        <Stateful initial="season-3">
          {(value, setValue) => (
            <SeasonSelect
              value={value}
              seasons={seasons}
              onChange={setValue}
            />
          )}
        </Stateful>
      </StoryPanel>
      <StoryPanel>
        <Stateful initial="list">
          {(value, setValue) => (
            <SegmentedControl
              value={value}
              onChange={setValue}
              options={[
                { value: 'list', label: 'List' },
                { value: 'calendar', label: 'Calendar' },
                { value: 'stats', label: 'Stats' },
              ]}
            />
          )}
        </Stateful>
      </StoryPanel>
    </StoryGrid>
  ),
} satisfies Story;

export const UploadAndRichText = {
  render: () => (
    <StoryGrid>
      <StoryPanel>
        <LogoUploadDemo />
      </StoryPanel>
      <StoryPanel>
        <RichTextDemo />
      </StoryPanel>
      <StoryPanel>
        <DescriptionEditor
          description="<p>Click this read area to edit the description inline.</p>"
          onSave={async () => true}
        />
      </StoryPanel>
    </StoryGrid>
  ),
} satisfies Story;
