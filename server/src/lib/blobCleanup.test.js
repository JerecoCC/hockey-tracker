const {
  buildReferenceSet,
  cleanupUnusedBlobs,
  isBlobReferenced,
  pathnameFromUrl,
} = require('./blobCleanup');

describe('blob cleanup helpers', () => {
  it('normalizes blob URLs to pathnames', () => {
    expect(pathnameFromUrl('https://store.public.blob.vercel-storage.com/teams/logo.png')).toBe(
      'teams/logo.png',
    );
    expect(pathnameFromUrl('players/photo.png')).toBe('players/photo.png');
  });

  it('matches blobs by stored URL or pathname', () => {
    const refs = buildReferenceSet([
      { url: 'https://store.public.blob.vercel-storage.com/teams/logo.png' },
    ]);

    expect(
      isBlobReferenced(
        {
          pathname: 'teams/logo.png',
          url: 'https://store.public.blob.vercel-storage.com/teams/logo.png',
        },
        refs,
      ),
    ).toBe(true);
    expect(
      isBlobReferenced(
        {
          pathname: 'teams/old-logo.png',
          url: 'https://store.public.blob.vercel-storage.com/teams/old-logo.png',
        },
        refs,
      ),
    ).toBe(false);
  });

  it('defaults to dry-run and does not delete unused blobs', async () => {
    const sql = jest.fn().mockResolvedValue([
      { url: 'https://store.public.blob.vercel-storage.com/teams/current.png' },
    ]);
    const listBlobs = jest.fn(async ({ prefix }) => ({
      blobs: [
        {
          pathname: `${prefix}current.png`,
          url: `https://store.public.blob.vercel-storage.com/${prefix}current.png`,
          size: 123,
        },
        {
          pathname: `${prefix}unused.png`,
          url: `https://store.public.blob.vercel-storage.com/${prefix}unused.png`,
          size: 456,
        },
      ],
      hasMore: false,
    }));
    const deleteBlobs = jest.fn();

    const result = await cleanupUnusedBlobs({
      sql,
      listBlobs,
      deleteBlobs,
      prefixes: ['teams/'],
    });

    expect(result.dryRun).toBe(true);
    expect(result.scannedCount).toBe(2);
    expect(result.unusedCount).toBe(1);
    expect(result.deletedCount).toBe(0);
    expect(result.unused[0].pathname).toBe('teams/unused.png');
    expect(deleteBlobs).not.toHaveBeenCalled();
  });

  it('deletes unused blobs when dryRun is false', async () => {
    const sql = jest.fn().mockResolvedValue([]);
    const listBlobs = jest.fn(async () => ({
      blobs: [
        {
          pathname: 'players/unused.png',
          url: 'https://store.public.blob.vercel-storage.com/players/unused.png',
        },
      ],
      hasMore: false,
    }));
    const deleteBlobs = jest.fn().mockResolvedValue(undefined);

    const result = await cleanupUnusedBlobs({
      sql,
      listBlobs,
      deleteBlobs,
      dryRun: false,
      prefixes: ['players/'],
    });

    expect(result.deletedCount).toBe(1);
    expect(deleteBlobs).toHaveBeenCalledWith([
      'https://store.public.blob.vercel-storage.com/players/unused.png',
    ]);
  });
});
