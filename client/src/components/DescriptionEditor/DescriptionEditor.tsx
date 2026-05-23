import { useState } from 'react';
import Button from '../Button/Button';
import Icon from '../Icon/Icon';
import { descriptionHtmlToTextarea, textareaToDescriptionHtml } from '@/lib/descriptionHtml';
import styles from './DescriptionEditor.module.scss';

interface Props {
  description: string | null;
  onSave: (html: string) => Promise<boolean>;
}

const normalize = (value: string) => textareaToDescriptionHtml(value) ?? '';

const DescriptionEditor = (props: Props) => {
  const { description, onSave } = props;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const openEditor = () => {
    setValue(descriptionHtmlToTextarea(description));
    setEditing(true);
  };

  return editing ? (
    <div className={styles.editor}>
      <textarea
        className={styles.textarea}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a description..."
        rows={6}
        disabled={saving}
      />
      <div className={styles.actions}>
        <Button
          size="sm"
          intent="accent"
          disabled={saving || normalize(value) === (description ?? '')}
          onClick={async () => {
            setSaving(true);
            const ok = await onSave(normalize(value));
            setSaving(false);
            if (ok) setEditing(false);
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button
          size="sm"
          variant="outlined"
          intent="neutral"
          disabled={saving}
          onClick={() => setEditing(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  ) : (
    <div
      className={styles.readArea}
      onClick={openEditor}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') openEditor();
      }}
    >
      {description && description !== '<p></p>' ? (
        <div
          className={styles.content}
          dangerouslySetInnerHTML={{ __html: description }}
        />
      ) : (
        <span className={styles.muted}>Click to add a description…</span>
      )}
      <Icon
        name="edit"
        className={styles.editIcon}
        size="0.85em"
      />
    </div>
  );
};

export default DescriptionEditor;
