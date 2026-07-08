let backgroundScrollLockCount = 0;
let lockedScrollY = 0;
let documentElementStyles: { overflow: string; overscrollBehavior: string } | null = null;
let bodyStyles: {
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  overflow: string;
  touchAction: string;
  overscrollBehavior: string;
} | null = null;
const scrollLockTargets = new WeakMap<
  HTMLElement,
  { overflow: string; touchAction: string; overscrollBehavior: string }
>();

const getAppScrollLockTargets = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-app-scroll-lock-target="true"]'));

export const lockBackgroundScroll = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (backgroundScrollLockCount === 0) {
    lockedScrollY = window.scrollY;
    documentElementStyles = {
      overflow: document.documentElement.style.overflow,
      overscrollBehavior: document.documentElement.style.overscrollBehavior,
    };
    bodyStyles = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
      touchAction: document.body.style.touchAction,
      overscrollBehavior: document.body.style.overscrollBehavior,
    };

    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.overscrollBehavior = 'none';

    for (const el of getAppScrollLockTargets()) {
      scrollLockTargets.set(el, {
        overflow: el.style.overflow,
        touchAction: el.style.touchAction,
        overscrollBehavior: el.style.overscrollBehavior,
      });
      el.style.overflow = 'hidden';
      el.style.touchAction = 'none';
      el.style.overscrollBehavior = 'none';
    }
  }
  backgroundScrollLockCount += 1;
};

export const unlockBackgroundScroll = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (backgroundScrollLockCount === 0) return;
  backgroundScrollLockCount -= 1;
  if (backgroundScrollLockCount === 0) {
    document.documentElement.style.overflow = documentElementStyles?.overflow ?? '';
    document.documentElement.style.overscrollBehavior =
      documentElementStyles?.overscrollBehavior ?? '';
    document.body.style.position = bodyStyles?.position ?? '';
    document.body.style.top = bodyStyles?.top ?? '';
    document.body.style.left = bodyStyles?.left ?? '';
    document.body.style.right = bodyStyles?.right ?? '';
    document.body.style.width = bodyStyles?.width ?? '';
    document.body.style.overflow = bodyStyles?.overflow ?? '';
    document.body.style.touchAction = bodyStyles?.touchAction ?? '';
    document.body.style.overscrollBehavior = bodyStyles?.overscrollBehavior ?? '';
    documentElementStyles = null;
    bodyStyles = null;

    for (const el of getAppScrollLockTargets()) {
      const prev = scrollLockTargets.get(el);
      el.style.overflow = prev?.overflow ?? '';
      el.style.touchAction = prev?.touchAction ?? '';
      el.style.overscrollBehavior = prev?.overscrollBehavior ?? '';
      scrollLockTargets.delete(el);
    }

    window.scrollTo(0, lockedScrollY);
  }
};
