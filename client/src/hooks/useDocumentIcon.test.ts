import { renderHook } from '@testing-library/react';
import useDocumentIcon from './useDocumentIcon';

const managedIconSelector = 'link[data-hockey-tracker-document-icon]';

describe('useDocumentIcon', () => {
  beforeEach(() => {
    document.head.innerHTML = '<link rel="icon" href="/favicon.ico">';
    jest.spyOn(Date, 'now').mockReturnValue(1234567890);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.head.innerHTML = '';
  });

  it('sets SVG team logos as document icons with the SVG MIME type', () => {
    const { unmount } = renderHook(() => useDocumentIcon('/logos/oilers.svg'));

    const link = document.querySelector<HTMLLinkElement>(managedIconSelector);
    expect(link).not.toBeNull();
    expect(link?.rel).toBe('icon');
    expect(link?.type).toBe('image/svg+xml');
    expect(link?.href).toBe('http://localhost/logos/oilers.svg?v=1234567890');

    unmount();

    const restoredLink = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    expect(restoredLink?.href).toBe('http://localhost/favicon.ico');
  });

  it('sets shortcut icon metadata for ICO files', () => {
    renderHook(() => useDocumentIcon('/favicon-team.ico'));

    const link = document.querySelector<HTMLLinkElement>(managedIconSelector);
    expect(link?.rel).toBe('shortcut icon');
    expect(link?.type).toBe('image/x-icon');
  });
});
