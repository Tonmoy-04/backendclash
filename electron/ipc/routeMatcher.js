function normalizePath(input) {
  if (!input) return '/';
  let p = String(input);
  if (!p.startsWith('/')) p = `/${p}`;
  // Remove query string if present
  const qIndex = p.indexOf('?');
  if (qIndex >= 0) p = p.slice(0, qIndex);
  // Collapse multiple slashes
  p = p.replace(/\/+/g, '/');
  // Remove trailing slash (except root)
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p;
}

function matchRoute(pattern, path) {
  const params = {};
  const normPattern = normalizePath(pattern);
  const normPath = normalizePath(path);

  const patternParts = normPattern.split('/').filter(Boolean);
  const pathParts = normPath.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) return null;

  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i];
    const pv = pathParts[i];

    if (pp.startsWith(':')) {
      const key = pp.slice(1);
      if (!key) return null;
      params[key] = decodeURIComponent(pv);
      continue;
    }

    if (pp !== pv) return null;
  }

  return params;
}

module.exports = {
  normalizePath,
  matchRoute
};
