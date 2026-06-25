import type { Preview } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext';
import '../src/index.scss';
import './storybook.scss';

const preview: Preview = {
  decorators: [
    (Story) => {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('token');
      }

      return (
        <MemoryRouter>
          <AuthProvider>
            <div className="storybook-shell">
              <Story />
            </div>
          </AuthProvider>
        </MemoryRouter>
      );
    },
  ],
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'app',
      values: [
        { name: 'app', value: '#0f172a' },
        { name: 'card', value: '#1e293b' },
        { name: 'light', value: '#f8fafc' },
      ],
    },
    controls: {
      expanded: true,
    },
  },
};

export default preview;
