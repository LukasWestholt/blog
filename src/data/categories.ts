const CATEGORY_CONFIG = {
	IT: { de: 'IT', en: 'IT' },
	Projects: { de: 'Projekte', en: 'Projects' },
	'Football Manager': { de: 'Football Manager', en: 'Football Manager' },
	Thoughts: { de: 'Gedanken', en: 'Thoughts' },
	Achievements: { de: 'Erfolge', en: 'Achievements' },
	Research: { de: 'Research', en: 'Research' },
} as const

type CategoryKey = keyof typeof CATEGORY_CONFIG

export const CATEGORIES = Object.keys(CATEGORY_CONFIG) as unknown as [CategoryKey, ...CategoryKey[]]

export function getCategoryTranslation(name: string, lang: 'de' | 'en'): string {
	if (name.toLowerCase() === 'view all') return lang === 'en' ? 'View All' : 'Alle anzeigen'
	const key = (Object.keys(CATEGORY_CONFIG) as CategoryKey[]).find(
		(k) => k.toLowerCase() === name.toLowerCase()
	)
	return key !== undefined ? CATEGORY_CONFIG[key][lang] : name
}