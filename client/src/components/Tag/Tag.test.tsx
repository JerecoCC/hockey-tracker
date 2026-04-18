import { render, screen } from '@testing-library/react';
import Tag from './Tag';

// identity-obj-proxy maps each CSS module class key to its own name as a string,
// so styles.success === 'success', styles.neutral === 'neutral', etc.

describe('Tag – rendering', () => {
  it('renders the label text', () => {
    render(<Tag label="Active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders a <span> element', () => {
    render(<Tag label="Active" />);
    expect(screen.getByText('Active').tagName).toBe('SPAN');
  });
});

describe('Tag – intent classes', () => {
  it('applies the success class for intent="success"', () => {
    render(<Tag label="Active" intent="success" />);
    expect(screen.getByText('Active')).toHaveClass('success');
  });

  it('applies the neutral class for intent="neutral"', () => {
    render(<Tag label="Inactive" intent="neutral" />);
    expect(screen.getByText('Inactive')).toHaveClass('neutral');
  });

  it('applies the danger class for intent="danger"', () => {
    render(<Tag label="Suspended" intent="danger" />);
    expect(screen.getByText('Suspended')).toHaveClass('danger');
  });

  it('applies the warning class for intent="warning"', () => {
    render(<Tag label="Pending" intent="warning" />);
    expect(screen.getByText('Pending')).toHaveClass('warning');
  });

  it('defaults to neutral when intent is omitted', () => {
    render(<Tag label="Default" />);
    expect(screen.getByText('Default')).toHaveClass('neutral');
  });

  it('always applies the base tag class', () => {
    render(<Tag label="Base" intent="success" />);
    expect(screen.getByText('Base')).toHaveClass('tag');
  });
});

describe('Tag – className prop', () => {
  it('merges a custom className with the base classes', () => {
    render(<Tag label="Custom" className="myClass" />);
    const el = screen.getByText('Custom');
    expect(el).toHaveClass('tag');
    expect(el).toHaveClass('myClass');
  });

  it('does not break when className is omitted', () => {
    render(<Tag label="NoClass" />);
    expect(screen.getByText('NoClass')).toBeInTheDocument();
  });
});
