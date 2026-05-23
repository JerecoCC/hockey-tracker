import { descriptionHtmlToTextarea, textareaToDescriptionHtml } from './descriptionHtml';

describe('descriptionHtml helpers', () => {
  it('converts rich text html into textarea-friendly text', () => {
    expect(descriptionHtmlToTextarea('<p>Hello<br />World</p><p>Again</p>')).toBe(
      'Hello\nWorld\n\nAgain',
    );
  });

  it('converts list items into newline-delimited text', () => {
    expect(descriptionHtmlToTextarea('<ul><li>One</li><li>Two</li></ul>')).toBe('• One\n• Two');
  });

  it('converts textarea text into safe html paragraphs', () => {
    expect(textareaToDescriptionHtml('Hello\nWorld\n\nAgain')).toBe(
      '<p>Hello<br />World</p><p>Again</p>',
    );
  });

  it('escapes raw html entered into the textarea', () => {
    expect(textareaToDescriptionHtml('<script>alert(1)</script>')).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
    );
  });

  it('returns null for empty textarea content', () => {
    expect(textareaToDescriptionHtml('   ')).toBeNull();
  });
});
