import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import LogoUpload from './LogoUpload';

interface FormValues {
  logo: string | File | null;
}

const LogoUploadHarness = ({
  disabled = false,
  value = null,
}: {
  disabled?: boolean;
  value?: string | null;
}) => {
  const { control } = useForm<FormValues>({
    defaultValues: { logo: value },
  });

  return (
    <LogoUpload
      control={control}
      name="logo"
      label="Logo"
      disabled={disabled}
    />
  );
};

describe('LogoUpload', () => {
  it('styles the empty upload target as disabled like other fields', () => {
    const { container } = render(<LogoUploadHarness disabled />);

    const uploadTarget = screen.getByText('Upload').closest('label');
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');

    expect(uploadTarget).toHaveClass('fileLabel', 'fileLabelDisabled');
    expect(uploadTarget).toHaveAttribute('aria-disabled', 'true');
    expect(uploadTarget).toHaveAttribute('tabindex', '-1');
    expect(input).toBeDisabled();
  });

  it('styles an existing preview as disabled and hides the clear action', () => {
    render(
      <LogoUploadHarness
        disabled
        value="/logos/team.svg"
      />,
    );

    const previewWrapper = screen.getByAltText('Preview').closest('div');

    expect(previewWrapper).toHaveClass('previewWrapper', 'previewWrapperDisabled');
    expect(previewWrapper).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('button', { name: 'Remove image' })).not.toBeInTheDocument();
  });
});
