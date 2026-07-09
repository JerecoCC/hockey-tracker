import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { useAuth } from '@/context/AuthContext';
import Button from '@jerecocc/tracker-ui/components/Button/Button';
import Card from '@jerecocc/tracker-ui/components/Card/Card';
import Divider from '@jerecocc/tracker-ui/components/Divider/Divider';
import Field from '@jerecocc/tracker-ui/components/Field/Field';
import GoogleButton from '@/shared/GoogleButton/GoogleButton';
import Icon from '@jerecocc/tracker-ui/components/Icon/Icon';
import styles from './Login.module.scss';

interface LoginForm {
  email: string;
  password: string;
}

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginForm>({
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleLogin = handleSubmit(async (values) => {
    try {
      await login(values);
      navigate('/dashboard');
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e?.response?.data?.error || 'Login failed. Please try again.');
    }
  });

  return (
    <div className={styles.page}>
      <Card
        variant="light"
        className={styles.authCard}
        data-theme="light"
      >
        <h1 className={styles.title}>
          <Icon
            name="sports_hockey"
            size="1.1em"
          />{' '}
          Hockey Tracker
        </h1>
        <h2 className={styles.subtitle}>Sign in to your account</h2>

        <form
          onSubmit={handleLogin}
          className={styles.form}
        >
          <Field
            control={control}
            name="email"
            type="email"
            label="Email"
            placeholder="you@example.com"
            autoComplete="email"
            wrapperClassName={styles.authField}
            required
            rules={{ required: 'Email is required.' }}
          />

          <Field
            control={control}
            name="password"
            type="password"
            label="Password"
            placeholder="Password"
            autoComplete="current-password"
            wrapperClassName={styles.authField}
            required
            rules={{ required: 'Password is required.' }}
          />

          <Button
            className={styles.primaryBtn}
            type="submit"
            size="large"
            icon="account_circle"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <Divider
          className={styles.authDivider}
          text="or"
        />

        <GoogleButton label="Sign in with Google" />

        <p className={styles.footer}>
          Don&apos;t have an account?{' '}
          <Link
            className={styles.link}
            to="/signup"
          >
            Sign up
          </Link>
        </p>
      </Card>
    </div>
  );
};

export default LoginPage;
