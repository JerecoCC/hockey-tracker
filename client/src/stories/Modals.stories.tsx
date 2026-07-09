import type { Meta, StoryObj } from '@storybook/react-vite';
import BulkCreateModal from '@jerecocc/tracker-ui/components/BulkCreateModal/BulkCreateModal';
import ConfirmModal from '@jerecocc/tracker-ui/components/ConfirmModal/ConfirmModal';
import Field from '@jerecocc/tracker-ui/components/Field/Field';
import ImagePreviewModal from '@jerecocc/tracker-ui/components/ImagePreviewModal/ImagePreviewModal';
import Modal from '@jerecocc/tracker-ui/components/Modal/Modal';
import { minLogo, noop, StoryPanel } from './storyData';

const meta = {
  title: 'Shared Components/Modals',
  parameters: {
    docs: {
      description: {
        component: 'Dialog, confirmation, image preview, and bulk-create modal patterns.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

interface BulkRow {
  name: string;
  code: string;
}

export const StandardModal = {
  render: () => (
    <Modal
      open
      title="Edit Award Definition"
      onClose={noop}
      onConfirm={noop}
      confirmLabel="Save Changes"
      confirmIcon="save"
      disableBackdropClose
    >
      <StoryPanel>
        <p style={{ margin: 0 }}>
          Modal bodies can host forms, lists, or grouped fieldsets while sharing a consistent
          footer.
        </p>
      </StoryPanel>
    </Modal>
  ),
} satisfies Story;

export const ConfirmationModal = {
  render: () => (
    <ConfirmModal
      open
      title="Remove Award Definition"
      body="Remove this award definition from the active league catalog?"
      confirmLabel="Remove"
      confirmIcon="delete"
      variant="danger"
      onCancel={noop}
      onConfirm={noop}
    />
  ),
} satisfies Story;

export const BulkCreate = {
  render: () => (
    <BulkCreateModal<{ rows: BulkRow[] }, BulkRow>
      open
      title="Bulk Create Teams"
      onClose={noop}
      onSubmitForm={async () => true}
      createDefaultValues={() => ({ rows: [{ name: 'Montreal Victoire', code: 'MTL' }] })}
      rowArrayName="rows"
      createRow={() => ({ name: '', code: '' })}
      formId="storybook-bulk-create"
      columnsTemplate="1fr 110px auto"
      headerCells={[
        { label: 'Name', required: true },
        { label: 'Code', required: true },
        { label: '' },
      ]}
      requiredRowFields={['name', 'code']}
      addRowLabel="Add Team"
      itemLabel="team"
      getConfirmLabel={(count, isSubmitting) =>
        isSubmitting ? 'Saving...' : `Create ${count} Team${count === 1 ? '' : 's'}`
      }
      renderRow={({ index, control, isSubmitting, autoFocus, deleteButton }) => (
        <>
          <Field
            control={control}
            name={`rows.${index}.name`}
            placeholder="Team name"
            disabled={isSubmitting}
            autoFocus={autoFocus}
          />
          <Field
            control={control}
            name={`rows.${index}.code`}
            placeholder="Code"
            disabled={isSubmitting}
          />
          {deleteButton}
        </>
      )}
      disableBackdropClose
    />
  ),
} satisfies Story;

export const ImagePreview = {
  render: () => (
    <ImagePreviewModal
      open
      src={minLogo}
      alt="Minnesota Frost logo"
      onClose={noop}
    />
  ),
} satisfies Story;
