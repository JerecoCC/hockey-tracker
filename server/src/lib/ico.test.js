const { normalizeIcoBuffer } = require('./ico');

const malformedBmpIco = () => {
  const buffer = Buffer.alloc(62);
  buffer.writeUInt16LE(0, 0);
  buffer.writeUInt16LE(1, 2);
  buffer.writeUInt16LE(1, 4);
  buffer[6] = 48;
  buffer[7] = 48;
  buffer.writeUInt16LE(1, 10);
  buffer.writeUInt16LE(32, 12);
  buffer.writeUInt32LE(40, 14);
  buffer.writeUInt32LE(22, 18);
  buffer.writeUInt32LE(40, 22);
  buffer.writeInt32LE(48, 26);
  buffer.writeInt32LE(48, 30);
  buffer.writeUInt16LE(1, 34);
  buffer.writeUInt16LE(32, 36);
  return buffer;
};

describe('normalizeIcoBuffer', () => {
  it('fixes BMP-backed ICO frames whose DIB height is missing the mask height', () => {
    const input = malformedBmpIco();
    const output = normalizeIcoBuffer(input);

    expect(output).not.toBe(input);
    expect(output.readInt32LE(30)).toBe(96);
  });

  it('leaves non-ICO buffers untouched', () => {
    const input = Buffer.from('not an icon');

    expect(normalizeIcoBuffer(input)).toBe(input);
  });
});
