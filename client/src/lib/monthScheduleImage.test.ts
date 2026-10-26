import { toPng } from 'html-to-image';
import { downloadMonthScheduleImage } from './monthScheduleImage';

jest.mock('html-to-image', () => ({ toPng: jest.fn() }));

const mockToPng = toPng as jest.MockedFunction<typeof toPng>;

describe('downloadMonthScheduleImage', () => {
  beforeEach(() => {
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('renders the image from a hidden copy of the calendar and removes it afterwards', async () => {
    const calendarNode = document.createElement('div');
    calendarNode.textContent = 'Calendar';
    document.body.appendChild(calendarNode);

    let host: HTMLElement | null = null;
    mockToPng.mockImplementationOnce(async (exportNode) => {
      host = exportNode.parentElement;
      expect(exportNode).toHaveAttribute('data-calendar-export', 'true');
      expect(exportNode).toHaveTextContent('Calendar');
      return 'data:image/png;base64,';
    });

    await downloadMonthScheduleImage({ calendarNode, calendarMonth: new Date(2026, 10, 1) });

    expect(host).not.toBeNull();
    expect(host!.parentElement).toBeNull();
    expect(host).toHaveAttribute('aria-hidden', 'true');
    expect(host).toHaveStyle({
      position: 'fixed',
      width: '0px',
      height: '0px',
      overflow: 'hidden',
    });
    expect(document.body.children).toHaveLength(1);
  });
});
