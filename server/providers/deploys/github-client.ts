/**
 * Minimal authenticated GitHub REST client. Shared by the deploy provider and
 * the workday-report Actions sweep so auth headers + error shape live in one place.
 */
export async function ghGet<T>(token: string, path: string): Promise<T> {
  const r = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!r.ok) {
    const body = (await r.text()).slice(0, 300);
    throw new Error(`GitHub ${r.status} ${path}: ${body}`);
  }
  return (await r.json()) as T;
}
