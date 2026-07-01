import GroupedFields from '@/components/GroupedFields/GroupedFields';
import LogoUpload from '@/components/LogoUpload/LogoUpload';
import styles from './TeamLogoUploadGroup.module.scss';

interface Props {
  control: unknown;
  disabled?: boolean;
}

const TeamLogoUploadGroup = ({ control, disabled }: Props) => (
  <GroupedFields
    legend="Team Logos"
    className={styles.logoGroup}
  >
    <LogoUpload
      control={control}
      name="logo_dark"
      label="Dark"
      full
      pasteMode="focus"
      disabled={disabled}
    />
    <LogoUpload
      control={control}
      name="logo_light"
      label="Light"
      full
      pasteMode="focus"
      disabled={disabled}
    />
  </GroupedFields>
);

export default TeamLogoUploadGroup;
