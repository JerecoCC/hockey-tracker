const DEFAULT_PREFIXES = ['leagues/', 'teams/', 'players/'];

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const pathnameFromUrl = (value) => {
  const raw = normalizeString(value);
  if (!raw) return null;
  try {
    return new URL(raw).pathname.replace(/^\/+/, '');
  } catch {
    return raw.replace(/^\/+/, '');
  }
};

const buildReferenceSet = (rows) => {
  const refs = new Set();
  rows.forEach((row) => {
    const value = normalizeString(row.url);
    if (!value) return;
    refs.add(value);
    const pathname = pathnameFromUrl(value);
    if (pathname) refs.add(pathname);
  });
  return refs;
};

const isBlobReferenced = (blob, references) => {
  const candidates = [blob.url, blob.downloadUrl, blob.pathname].map(normalizeString).filter(Boolean);
  return candidates.some((candidate) => references.has(candidate) || references.has(pathnameFromUrl(candidate)));
};

async function listBlobsByPrefixes(listBlobs, prefixes = DEFAULT_PREFIXES) {
  const blobs = [];
  for (const prefix of prefixes) {
    let cursor;
    do {
      const page = await listBlobs({
        prefix,
        cursor,
        limit: 1000,
      });
      blobs.push(...(page.blobs ?? []));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  }
  return blobs;
}

async function getReferencedImageRows(sql) {
  return sql`
    SELECT logo AS url FROM leagues WHERE logo IS NOT NULL
    UNION
    SELECT icon AS url FROM leagues WHERE icon IS NOT NULL
    UNION
    SELECT logo_dark AS url FROM team_iterations WHERE logo_dark IS NOT NULL
    UNION
    SELECT logo_light AS url FROM team_iterations WHERE logo_light IS NOT NULL
    UNION
    SELECT icon AS url FROM team_iterations WHERE icon IS NOT NULL
    UNION
    SELECT photo AS url FROM players WHERE photo IS NOT NULL
    UNION
    SELECT photo AS url FROM player_teams WHERE photo IS NOT NULL
    UNION
    SELECT photo AS url FROM player_photos WHERE photo IS NOT NULL
  `;
}

async function cleanupUnusedBlobs({
  sql,
  listBlobs,
  deleteBlobs,
  dryRun = true,
  prefixes = DEFAULT_PREFIXES,
}) {
  const referenceRows = await getReferencedImageRows(sql);
  const references = buildReferenceSet(referenceRows);
  const blobs = await listBlobsByPrefixes(listBlobs, prefixes);
  const unused = blobs.filter((blob) => !isBlobReferenced(blob, references));
  const unusedUrls = unused.map((blob) => blob.url || blob.pathname).filter(Boolean);

  if (!dryRun && unusedUrls.length > 0) {
    await deleteBlobs(unusedUrls);
  }

  return {
    dryRun,
    prefixes,
    referencedCount: references.size,
    scannedCount: blobs.length,
    unusedCount: unused.length,
    deletedCount: dryRun ? 0 : unusedUrls.length,
    unused: unused.map((blob) => ({
      pathname: blob.pathname,
      url: blob.url,
      size: blob.size,
      uploadedAt: blob.uploadedAt,
    })),
  };
}

module.exports = {
  DEFAULT_PREFIXES,
  buildReferenceSet,
  cleanupUnusedBlobs,
  isBlobReferenced,
  listBlobsByPrefixes,
  pathnameFromUrl,
};
