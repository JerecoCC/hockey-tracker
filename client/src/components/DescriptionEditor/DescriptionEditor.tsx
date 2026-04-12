import { useState } from 'react';
import Button from '../Button/Button';
import Icon from '../Icon/Icon';
import RichTextEditor from '../RichTextEditor/RichTextEditor';
import styles from './DescriptionEditor.module.scss';

interface Props {
  description: string | null;
  onSave: (html: string) => Promise<boolean>;
}

const normalize = (html: string) => (html.trim() === '<p></p>' ? '' : html);

const DescriptionEditor = ({ description, onSave }: Props) => {
  const [editing, setEditing] = useState(false);
  const [html, setHtml] = useState('');
  const [saving, setSaving] = useState(false);

  const openEditor = () => {
    setHtml(description ?? '');
    setEditing(true);
  };

  return editing ? (
    <div className={styles.editor}>
      <RichTextEditor
        content={html}
        onChange={setHtml}
        editable={!saving}
      />
      <div className={styles.actions}>
        <Button
          size="sm"
          intent="accent"
          disabled={saving || normalize(html) === (description ?? '')}
          onClick={async () => {
            setSaving(true);
            const ok = await onSave(normalize(html));
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
