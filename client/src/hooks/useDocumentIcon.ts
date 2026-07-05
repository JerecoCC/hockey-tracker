import { useEffect } from 'react';

const MANAGED_ICON_ATTR = 'data-hockey-tracker-document-icon';

const iconPath = (href: string) => {
  try {
    return new URL(href, window.location.href).pathname.toLowerCase();
  } catch {
    return href.toLowerCase().split('?')[0];
  }
};

const iconType = (href: string) => {
  const path = iconPath(href);
  if (path.endsWith('.ico')) return 'image/x-icon';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.gif')) return 'image/gif';
  return 'image/png';
};

const iconHref = (href: string) => {
  const resolved = new URL(href, window.location.href);
  resolved.searchParams.set('v', Date.now().toString());
  return resolved.toString();
};

const findIconLinks = () =>
  Array.from(
    document.querySelectorAll<HTMLLinkElement>(
      'link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]',
    ),
  );

const useDocumentIcon = (href: string | null | undefined) => {
  useEffect(() => {
    if (!href) return;

    const previousLinks = findIconLinks()
      .filter((link) => !link.hasAttribute(MANAGED_ICON_ATTR))
      .map((link) => link.cloneNode(true) as HTMLLinkElement);

    findIconLinks().forEach((link) => link.remove());

    const link = document.createElement('link');
    link.rel = iconPath(href).endsWith('.ico') ? 'shortcut icon' : 'icon';
    link.type = iconType(href);
    link.href = iconHref(href);
    link.setAttribute(MANAGED_ICON_ATTR, 'true');
    document.head.appendChild(link);

    return () => {
      link.remove();
      if (findIconLinks().some((item) => item.hasAttribute(MANAGED_ICON_ATTR))) return;
      previousLinks.forEach((previousLink) => document.head.appendChild(previousLink));
    };
  }, [href]);
};

export default useDocumentIcon;
