import { toPng } from 'html-to-image';

const MONTH_IMAGE_LABEL_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
});

const EXPORT_IMAGE_WIDTH = 1376;
const EXPORT_PADDING = 28;
const EXPORT_CALENDAR_WIDTH = EXPORT_IMAGE_WIDTH - EXPORT_PADDING * 2;

interface DownloadMonthScheduleImageOptions {
  calendarNode: HTMLElement;
  calendarMonth: Date;
  filename?: string;
  filenamePrefix?: string;
  headerLabel?: string;
}

export const downloadMonthScheduleImage = async ({
  calendarNode,
  calendarMonth,
  filename,
  filenamePrefix,
  headerLabel,
}: DownloadMonthScheduleImageOptions) => {
  const backgroundColor = getNearestBackgroundColor(calendarNode);
  const headerColor = getNearestCustomPropertyValue(
    calendarNode,
    '--app-text-strong',
    '#f8fafc',
  );
  const exportNode = document.createElement('div');
  const exportStyleNode = document.createElement('style');
  const headerNode = document.createElement('div');
  const clonedCalendar = calendarNode.cloneNode(true) as HTMLElement;
  const monthLabel = MONTH_IMAGE_LABEL_FMT.format(calendarMonth);
  const displayLabel = headerLabel ?? monthLabel;

  exportNode.setAttribute('data-calendar-export', 'true');
  Object.assign(exportNode.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    zIndex: '-1',
    width: `${EXPORT_IMAGE_WIDTH}px`,
    padding: `${EXPORT_PADDING}px`,
    boxSizing: 'border-box',
    background: backgroundColor,
    pointerEvents: 'none',
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  });
  exportStyleNode.textContent = `
    [data-calendar-export="true"] * {
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
    }

    [data-calendar-export="true"] *::-webkit-scrollbar {
      width: 0 !important;
      height: 0 !important;
      display: none !important;
    }

    [data-calendar-export="true"] [class*="grid"] {
      width: 100% !important;
      min-width: 0 !important;
    }

    [data-calendar-export="true"] [class*="dayCell"],
    [data-calendar-export="true"] [class*="emptyCell"] {
      aspect-ratio: auto !important;
      min-height: var(--calendar-export-day-min-height, 0px) !important;
    }

    [data-calendar-export="true"] [class*="dayCell"] {
      overflow: visible !important;
    }

    [data-calendar-export="true"] [class*="dayBody"] {
      height: auto !important;
      max-height: none !important;
      min-height: 0 !important;
      overflow: visible !important;
      scrollbar-gutter: auto !important;
    }

    [data-calendar-export="true"] [class*="dayContent"] {
      height: auto !important;
      min-height: 0 !important;
    }

    [data-calendar-export="true"] [class*="calendarGameList"] > :last-child {
      margin-bottom: 0 !important;
    }
  `;
  Object.assign(headerNode.style, {
    margin: '0 0 20px',
    color: headerColor,
    fontSize: '28px',
    fontWeight: '700',
    lineHeight: '1.15',
  });
  headerNode.textContent = displayLabel;
  Object.assign(clonedCalendar.style, {
    width: `${EXPORT_CALENDAR_WIDTH}px`,
    minWidth: `${EXPORT_CALENDAR_WIDTH}px`,
    pointerEvents: 'none',
  });

  exportNode.append(exportStyleNode, headerNode, clonedCalendar);
  document.body.appendChild(exportNode);
  await new Promise((resolve) => requestAnimationFrame(resolve));
  setCalendarExportDayMinHeight(clonedCalendar);
  await new Promise((resolve) => requestAnimationFrame(resolve));

  const width = EXPORT_IMAGE_WIDTH;
  const height = Math.ceil(exportNode.scrollHeight);
  let url: string;
  try {
    url = await toPng(exportNode, {
      cacheBust: true,
      pixelRatio: 1,
      backgroundColor,
      width,
      height,
      canvasWidth: width,
      canvasHeight: height,
      style: {
        width: `${width}px`,
        height: `${height}px`,
      },
    });
  } finally {
    document.body.removeChild(exportNode);
  }

  const link = document.createElement('a');
  link.href = url;
  link.download =
    filename ??
    `${filenamePrefix ?? 'schedule'}-${monthLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const getNearestBackgroundColor = (node: HTMLElement) => {
  let current: HTMLElement | null = node;
  while (current) {
    const color = window.getComputedStyle(current).backgroundColor;
    if (color && color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') return color;
    current = current.parentElement;
  }
  return '#0f172a';
};

const getNearestCustomPropertyValue = (
  node: HTMLElement,
  propertyName: string,
  fallback: string,
) => {
  let current: HTMLElement | null = node;
  while (current) {
    const value = window.getComputedStyle(current).getPropertyValue(propertyName).trim();
    if (value) return value;
    current = current.parentElement;
  }

  const rootValue = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(propertyName)
    .trim();
  return rootValue || fallback;
};

const setCalendarExportDayMinHeight = (calendarNode: HTMLElement) => {
  const firstDayCell = calendarNode.querySelector<HTMLElement>(
    '[class*="dayCell"], [class*="emptyCell"]',
  );
  const cellWidth = firstDayCell?.getBoundingClientRect().width ?? 0;
  if (cellWidth <= 0) return;

  calendarNode.style.setProperty(
    '--calendar-export-day-min-height',
    `${Math.ceil(cellWidth)}px`,
  );
};
