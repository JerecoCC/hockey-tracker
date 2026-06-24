export const playerDataComplete = (
  dateOfBirth: string | null,
  startDate: string | null,
  acquisitionType: string | null,
  isAdmin: boolean,
) => {
  if (!isAdmin) return '';

  let emoji = '';
  if (dateOfBirth && startDate && acquisitionType) {
    emoji = ' \u2705';
  } else {
    if (dateOfBirth) {
      emoji += ' \uD83D\uDCDD';
    }
    if (startDate) {
      emoji += ' \uD83D\uDD70\uFE0F';
    }
    if (acquisitionType) {
      emoji += ' \uD83E\uDD1D\uD83C\uDFFC';
    }
  }
  return emoji;
};

export const missingPlayerDataIndicator = '\u26A0\uFE0F';
