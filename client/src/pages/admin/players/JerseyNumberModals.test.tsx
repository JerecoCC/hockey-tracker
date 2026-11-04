import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ChangeJerseyModal from './ChangeJerseyModal';
import JerseyHistoryEditModal from './JerseyHistoryEditModal';

jest.mock('@jerecocc/tracker-ui/components/Modal/Modal', () => ({
  __esModule: true,
  default: ({ children, open, title }: { children: ReactNode; open: boolean; title: string }) =>
    open ? (
      <div
        role="dialog"
        aria-label={title}
      >
        {children}
      </div>
    ) : null,
}));

jest.mock('@/components/form/ControlledFields', () => {
  const { Controller } = jest.requireActual('react-hook-form');

  interface MockFieldProps {
    autoFocus?: boolean;
    control: unknown;
    disabled?: boolean;
    label: string;
    name: string;
    rules?: unknown;
    type?: string;
  }

  const MockField = ({
    autoFocus,
    control,
    disabled,
    label,
    name,
    rules,
    type,
  }: MockFieldProps) => (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field }: { field: { onChange: (value: string) => void; value: string } }) => (
        <label>
          {label}
          <input
            aria-label={label}
            autoFocus={autoFocus}
            disabled={disabled}
            type={type}
            value={field.value ?? ''}
            onChange={(event) => field.onChange(event.target.value)}
          />
        </label>
      )}
    />
  );

  MockField.displayName = 'MockField';

  return {
    __esModule: true,
    ControlledDatePickerField: MockField,
    ControlledInputField: MockField,
  };
});

describe('jersey number modals', () => {
  it('opens the record-change modal with a blank, focused jersey number field', async () => {
    render(
      <ChangeJerseyModal
        open
        currentJerseyNumber={27}
        onClose={jest.fn()}
        changeJerseyNumber={jest.fn().mockResolvedValue(true)}
      />,
    );

    const jerseyNumber = screen.getByLabelText('Jersey #');

    await waitFor(() => {
      expect(jerseyNumber).toHaveValue(null);
      expect(jerseyNumber).toHaveFocus();
    });
  });

  it('opens the edit modal with the existing, focused jersey number field', async () => {
    render(
      <JerseyHistoryEditModal
        open
        entry={{
          id: 'history-1',
          player_id: 'player-1',
          jersey_number: 42,
          effective_from: '2026-01-01',
          effective_to: null,
        }}
        onClose={jest.fn()}
        updateJerseyHistoryEntry={jest.fn().mockResolvedValue(true)}
      />,
    );

    const jerseyNumber = screen.getByLabelText('Jersey #');

    await waitFor(() => {
      expect(jerseyNumber).toHaveValue(42);
      expect(jerseyNumber).toHaveFocus();
    });
  });

  it('hides while the change saves and reappears with the edit when saving fails', async () => {
    let finishSave: (ok: boolean) => void = () => {};
    const updateJerseyHistoryEntry = jest.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishSave = resolve;
        }),
    );
    const onClose = jest.fn();
    render(
      <JerseyHistoryEditModal
        open
        entry={{
          id: 'history-1',
          player_id: 'player-1',
          jersey_number: 42,
          effective_from: '2026-01-01',
          effective_to: null,
        }}
        onClose={onClose}
        updateJerseyHistoryEntry={updateJerseyHistoryEntry}
      />,
    );

    fireEvent.change(screen.getByLabelText('Jersey #'), { target: { value: '43' } });
    fireEvent.submit(document.getElementById('edit-jersey-history-form')!);

    // Hidden straight away, while the save runs behind a progress toast...
    await waitFor(() => expect(screen.queryByLabelText('Jersey #')).not.toBeInTheDocument());
    expect(updateJerseyHistoryEntry).toHaveBeenCalledWith('history-1', {
      jersey_number: 43,
      effective_from: '2026-01-01',
    });
    // ...then back, still holding the edit, once it fails.
    finishSave(false);
    expect(await screen.findByLabelText('Jersey #')).toHaveValue(43);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes once the change saves', async () => {
    const onClose = jest.fn();
    render(
      <ChangeJerseyModal
        open
        currentJerseyNumber={27}
        onClose={onClose}
        changeJerseyNumber={jest.fn().mockResolvedValue(true)}
      />,
    );

    fireEvent.change(screen.getByLabelText('Jersey #'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Effective Date'), {
      target: { value: '2026-02-01' },
    });
    fireEvent.submit(document.getElementById('change-jersey-form')!);

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
