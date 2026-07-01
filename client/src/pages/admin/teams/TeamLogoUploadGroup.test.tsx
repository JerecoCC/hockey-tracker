import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import TeamLogoUploadGroup from './TeamLogoUploadGroup';

const TeamLogoUploadGroupHarness = () => {
  const { control } = useForm({
    defaultValues: {
      logo_dark: null,
      logo_light: null,
    },
  });

  return <TeamLogoUploadGroup control={control} />;
};

describe('TeamLogoUploadGroup', () => {
  it('renders connected dark and light logo upload sections', () => {
    render(<TeamLogoUploadGroupHarness />);

    expect(screen.getByText('Team Logos')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('Light')).toBeInTheDocument();
  });
});
