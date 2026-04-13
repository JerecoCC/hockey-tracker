import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import styles from './RichTextEditor.module.scss';

interface ToolbarButtonProps {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
  disabled?: boolean;
}

const ToolbarButton = (props: ToolbarButtonProps) => {
  const { active, onClick, children, title, disabled } = props;
  return (
    <button
      type="button"
      className={`${styles.toolbarBtn} ${active ? styles.toolbarBtnActive : ''}`}
      onMouseDown={(e) => {
        e.preventDefault(); // keep editor focus
        onClick();
      }}
      title={title}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

interface Props {
  content: string;
  onChange: (html: string) => void;
  autoFocus?: boolean;
  editable?: boolean;
}

const RichTextEditor = (props: Props) => {
  const { content, onChange, autoFocus = true, editable = true } = props;
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    autofocus: autoFocus ? 'end' : false,
    editable,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editor, editable]);

  // Sync external content changes (e.g. form reset populating the field after mount)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false);
    }
  }, [editor, content]);

  if (!editor) return null;

  return (
    <div className={`${styles.wrapper} ${!editable ? styles.wrapperDisabled : ''}`}>
      <div className={styles.toolbar}>
        <ToolbarButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
          disabled={!editable}
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
          disabled={!editable}
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
          disabled={!editable}
        >
          <s>S</s>
        </ToolbarButton>
        <span className={styles.divider} />
        <ToolbarButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
          disabled={!editable}
        >
          ≡
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Ordered list"
          disabled={!editable}
        >
          1.
        </ToolbarButton>
      </div>
      <EditorContent
        editor={editor}
        className={`${styles.editorContent} ${!editable ? styles.editorContentDisabled : ''}`}
      />
    </div>
  );
};

export default RichTextEditor;
