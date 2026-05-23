import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DescriptionEditor from './DescriptionEditor';

const openEditor = (description: string | null = null) => {
  render(
    <DescriptionEditor
      description={description}
      onSave={jest.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button'));
};

describe('DescriptionEditor – read mode', () => {
  it('renders HTML description content', () => {
    render(
      <DescriptionEditor
        description="<p>Hello world</p>"
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders a placeholder when description is null', () => {
    render(
      <DescriptionEditor
        description={null}
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByText('Click to add a description…')).toBeInTheDocument();
  });

  it('renders a placeholder when description is "<p></p>"', () => {
    render(
      <DescriptionEditor
        description="<p></p>"
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByText('Click to add a description…')).toBeInTheDocument();
  });

  it('enters edit mode on click', () => {
    render(
      <DescriptionEditor
        description={null}
        onSave={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByPlaceholderText('Add a description...')).toBeInTheDocument();
  });

  it('enters edit mode on Enter key', () => {
    render(
      <DescriptionEditor
        description={null}
        onSave={jest.fn()}
      />,
    );
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(screen.getByPlaceholderText('Add a description...')).toBeInTheDocument();
  });

  it('enters edit mode on Space key', () => {
    render(
      <DescriptionEditor
        description={null}
        onSave={jest.fn()}
      />,
    );
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
    expect(screen.getByPlaceholderText('Add a description...')).toBeInTheDocument();
  });
});

describe('DescriptionEditor – edit mode', () => {
  it('shows Save and Cancel buttons in edit mode', () => {
    openEditor();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('Cancel returns to read mode', () => {
    openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByPlaceholderText('Add a description...')).toBeNull();
    expect(screen.getByRole('button')).toBeInTheDocument(); // read area
  });

  it('Save is disabled when content matches the original description', () => {
    render(
      <DescriptionEditor
        description="<p>Hello</p>"
        onSave={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('Save is enabled after content changes', () => {
    render(
      <DescriptionEditor
        description="<p>Hello</p>"
        onSave={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(screen.getByPlaceholderText('Add a description...'), {
      target: { value: 'Updated' },
    });
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
  });

  it('calls onSave with the updated html when Save is clicked', async () => {
    const onSave = jest.fn().mockResolvedValue(true);
    render(
      <DescriptionEditor
        description="<p>Hello</p>"
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(screen.getByPlaceholderText('Add a description...'), {
      target: { value: 'Updated' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('<p>Updated</p>'));
  });

  it('normalizes empty text to "" before calling onSave', async () => {
    const onSave = jest.fn().mockResolvedValue(true);
    render(
      <DescriptionEditor
        description="<p>Hello</p>"
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(screen.getByPlaceholderText('Add a description...'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(''));
  });

  it('exits edit mode after a successful save', async () => {
    const onSave = jest.fn().mockResolvedValue(true);
    render(
      <DescriptionEditor
        description="<p>Hello</p>"
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(screen.getByPlaceholderText('Add a description...'), {
      target: { value: 'Updated' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByPlaceholderText('Add a description...')).toBeNull());
  });

  it('stays in edit mode after a failed save', async () => {
    const onSave = jest.fn().mockResolvedValue(false);
    render(
      <DescriptionEditor
        description="<p>Hello</p>"
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(screen.getByPlaceholderText('Add a description...'), {
      target: { value: 'Updated' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(screen.getByPlaceholderText('Add a description...')).toBeInTheDocument();
  });

  it('prefills the textarea with plain text converted from html', () => {
    render(
      <DescriptionEditor
        description="<p>Hello<br />World</p><p>Again</p>"
        onSave={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByPlaceholderText('Add a description...')).toHaveValue(
      'Hello\nWorld\n\nAgain',
    );
  });
});
