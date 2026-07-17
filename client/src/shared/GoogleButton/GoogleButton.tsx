import Button from '@jerecocc/tracker-ui/components/Button/Button';
import { useAuth } from '@/context/AuthContext';
import GoogleLogo from '@/shared/GoogleLogo/GoogleLogo';
import styles from './GoogleButton.module.scss';

interface GoogleButtonProps {
  label?: string;
}

const GoogleButton = (props: GoogleButtonProps) => {
  const { label = 'Continue with Google' } = props;
  const { loginWithGoogle } = useAuth();

  return (
    <Button
      variant="ghost"
      intent="neutral"
      className={styles.googleBtn}
      onClick={loginWithGoogle}
      type="button"
    >
      <GoogleLogo className={styles.icon} />
      {label}
    </Button>
  );
};

export default GoogleButton;
