import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Field from '@/components/Field/Field';
import BulkCreateModal from './BulkCreateModal';

interface TestRow {
  name: string;
}

const renderModal = (overrides?: {
  onSubmitForm?: jest.Mock<Promise<boolean>, [{ rows: TestRow[] }]>;
}) => {
  const onSubmitForm =
    overrides?.onSubmitForm ??
    jest.fn<Promise<boolean>, [{ rows: TestRow[] }]>().mockResolvedValue(true);

  render(
    <BulkCreateModal<{ rows: TestRow[] }, TestRow>
      open
      title="Bulk Create Test"
      onClose={() => {}}
      onSubmitForm={onSubmitForm}
      createDefaultValues={() => ({ rows: [{ name: '' }] })}
      rowArrayName="rows"
      createRow={() => ({ name: '' })}
      formId="bulk-create-test-form"
      columnsTemplate="1fr"
      headerCells={[{ label: 'Name', required: true }]}
      addRowLabel="Add Row"
      itemLabel="row"
      getConfirmLabel={(count, isSubmitting) =>
        isSubmitting ? 'Saving…' : `Save ${count} Row${count !== 1 ? 's' : ''}`
      }
      shouldConfirmRemove={(row) => !!row.name}
      getRemoveConfirmBody={(row) => `Remove ${row.name}?`}
      renderRow={({ index, control, isSubmitting, autoFocus, deleteButton }) => (
        <>
          <Field
            control={control}
            name={`rows.${index}.name`}
            placeholder="Name"
            disabled={isSubmitting}
            autoFocus={autoFocus}
            rules={{ required: true }}
          />
          {deleteButton}
        </>
      )}
    />,
  );

  return { onSubmitForm };
};

describe('BulkCreateModal', () => {
  it('adds rows and submits all row values', async () => {
    const user = userEvent.setup();
    const { onSubmitForm } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Add Row' }));

    const inputs = screen.getAllByPlaceholderText('Name');
    await user.type(inputs[0], 'Alice');
    await user.type(inputs[1], 'Bob');
    await user.click(screen.getByRole('button', { name: 'Save 2 Rows' }));

    await waitFor(() => {
      expect(onSubmitForm).toHaveBeenCalledWith({ rows: [{ name: 'Alice' }, { name: 'Bob' }] });
    });
  });

  it('removes pristine rows immediately and confirms dirty row removal', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: 'Add Row' }));
    expect(screen.getAllByPlaceholderText('Name')).toHaveLength(2);

    await user.click(screen.getAllByRole('button', { name: 'Remove row' })[1]);
    expect(screen.queryByText('Remove ?')).not.toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('Name')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Add Row' }));
    const inputs = screen.getAllByPlaceholderText('Name');
    await user.type(inputs[1], 'Bob');
    await user.click(screen.getAllByRole('button', { name: 'Remove row' })[1]);

    expect(screen.getByText('Remove Bob?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Name')).toHaveLength(1);
    });
  });
});
