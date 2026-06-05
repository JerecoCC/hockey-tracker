'use strict';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const readUInt32 = (buffer, offset) => {
  if (offset + 4 > buffer.length) return null;
  return buffer.readUInt32LE(offset);
};

const normalizeIcoBuffer = (input) => {
  if (!Buffer.isBuffer(input) || input.length < 22) return input;
  if (input.readUInt16LE(0) !== 0 || input.readUInt16LE(2) !== 1) return input;

  const count = input.readUInt16LE(4);
  if (input.length < 6 + count * 16) return input;

  let output = input;

  for (let i = 0; i < count; i += 1) {
    const entryOffset = 6 + i * 16;
    const directoryHeight = input[entryOffset + 1] || 256;
    const imageSize = readUInt32(input, entryOffset + 8);
    const imageOffset = readUInt32(input, entryOffset + 12);
    if (imageSize === null || imageOffset === null) continue;
    if (imageOffset + Math.min(imageSize, 8) > input.length) continue;
    if (input.subarray(imageOffset, imageOffset + 8).equals(PNG_SIGNATURE)) continue;

    const dibHeaderSize = readUInt32(input, imageOffset);
    if (dibHeaderSize === null || dibHeaderSize < 16 || imageOffset + dibHeaderSize > input.length) continue;

    const heightOffset = imageOffset + 8;
    if (heightOffset + 4 > input.length) continue;
    const dibHeight = input.readInt32LE(heightOffset);

    if (dibHeight === directoryHeight) {
      if (output === input) output = Buffer.from(input);
      output.writeInt32LE(directoryHeight * 2, heightOffset);
    }
  }

  return output;
};

module.exports = { normalizeIcoBuffer };
