# @hockey-tracker/ui

Reusable React components extracted from the Hockey Tracker client.

## Usage

```tsx
import { Button, Modal, Select } from '@hockey-tracker/ui';
import '@hockey-tracker/ui/style.css';
```

For local development in this repository, the client aliases `@hockey-tracker/ui` to this package's `src` folder so component changes are picked up without publishing.

## Build

```bash
npm run build
```

The build emits preserved ES modules and declaration files into `dist/`, so consumers can import from the package root or from deep component paths such as `@hockey-tracker/ui/components/Button/Button`.
