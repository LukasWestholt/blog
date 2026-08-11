export function url(path: string): string {
	if (path === '#') return '#'
	const base = import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL.replace(/\/$/, '')
	return base + path
}

export function stripBase(pathname: string): string {
	const base = import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL.replace(/\/$/, '')
	return base && pathname.startsWith(base) ? pathname.slice(base.length) || '/' : pathname
}