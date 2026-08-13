export function url(path: string, base = import.meta.env.BASE_URL): string {
	if (path === '#') return '#'
	const b = base === '/' ? '' : base.replace(/\/$/, '')
	return b + path
}

export function stripBase(pathname: string, base = import.meta.env.BASE_URL): string {
	const b = base === '/' ? '' : base.replace(/\/$/, '')
	return b && pathname.startsWith(b) ? pathname.slice(b.length) || '/' : pathname
}
