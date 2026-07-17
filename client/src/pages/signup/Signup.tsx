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
import styles from '@/shared/AuthPage/AuthPage.module.scss';

interface SignupForm {
  name: string;
  email: string;
  password: string;
  confirm: string;
}

const SignupPage = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const {
    control,
    getValues,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SignupForm>({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirm: '',
    },
  });

  const handleSignup = handleSubmit(async ({ name, email, password }) => {
    try {
      await signup({ name, email, password });
      navigate('/dashboard');
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e?.response?.data?.error || 'Signup failed. Please try again.');
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
        <h2 className={styles.subtitle}>Create an account</h2>

        <form
          onSubmit={handleSignup}
          className={styles.form}
        >
          <Field
            control={control}
            name="name"
            type="text"
            label="Name"
            placeholder="Wayne Gretzky"
            autoComplete="name"
            wrapperClassName={styles.authField}
            required
            rules={{ required: 'Name is required.' }}
          />

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
            placeholder="Min. 6 characters"
            autoComplete="new-password"
            wrapperClassName={styles.authField}
            required
            rules={{
              required: 'Password is required.',
              minLength: {
                value: 6,
                message: 'Password must be at least 6 characters.',
              },
            }}
          />

          <Field
            control={control}
            name="confirm"
            type="password"
            label="Confirm password"
            placeholder="Confirm password"
            autoComplete="new-password"
            wrapperClassName={styles.authField}
            required
            rules={{
              required: 'Please confirm your password.',
              validate: (value) => value === getValues('password') || 'Passwords do not match.',
            }}
          />

          <Button
            className={styles.primaryBtn}
            type="submit"
            size="large"
            icon="person_add"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </Button>
        </form>

        <Divider
          className={styles.authDivider}
          text="or"
        />

        <GoogleButton label="Sign up with Google" />

        <p className={styles.footer}>
          Already have an account?{' '}
          <Link
            className={styles.link}
            to="/login"
          >
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
};

export default SignupPage;
