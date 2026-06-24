import { toPng } from 'html-to-image';

const MONTH_IMAGE_LABEL_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
});

interface DownloadMonthScheduleImageOptions {
  calendarNode: HTMLElement;
  calendarMonth: Date;
  filename?: string;
  filenamePrefix?: string;
  headerLabel?: string;
  exportWidth?: number;
}

export const downloadMonthScheduleImage = async ({
  calendarNode,
  calendarMonth,
  filename,
  filenamePrefix,
  headerLabel,
  exportWidth = 1600,
}: DownloadMonthScheduleImageOptions) => {
  const backgroundColor = getNearestBackgroundColor(calendarNode);
  const exportPadding = 28;
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
    width: `${exportWidth + exportPadding * 2}px`,
    padding: `${exportPadding}px`,
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
  `;
  Object.assign(headerNode.style, {
    margin: '0 0 20px',
    color: '#f8fafc',
    fontSize: '28px',
    fontWeight: '700',
    lineHeight: '1.15',
  });
  headerNode.textContent = displayLabel;
  Object.assign(clonedCalendar.style, {
    width: `${exportWidth}px`,
    minWidth: `${exportWidth}px`,
    pointerEvents: 'none',
  });

  exportNode.append(exportStyleNode, headerNode, clonedCalendar);
  document.body.appendChild(exportNode);
  await new Promise((resolve) => requestAnimationFrame(resolve));

  const width = exportNode.scrollWidth;
  const height = exportNode.scrollHeight;
  let url: string;
  try {
    url = await toPng(exportNode, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor,
      width,
      height,
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
