import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { describe, it, expect } from 'vitest'
import Category from './Category.astro'

function classesOf(html: string): string[] {
	const match = html.match(/class="([^"]*)"/)
	if (!match) throw new Error(`no class attribute found in: ${html}`)
	return match[1].split(/\s+/)
}

describe('Category', () => {
	it('gives the active category a visible border, distinct from inactive ones', async () => {
		const container = await AstroContainer.create()

		const activeClasses = classesOf(
			await container.renderToString(Category, {
				props: { name: 'Football Manager', activeCategory: 'football-manager' }
			})
		)
		const inactiveClasses = classesOf(
			await container.renderToString(Category, {
				props: { name: 'Projects', activeCategory: 'football-manager' }
			})
		)

		// active link: solid border, no leftover transparent override
		expect(activeClasses).toContain('border-secondary')
		expect(activeClasses).not.toContain('border-transparent')

		// inactive link: border hidden until hover, never plain border-secondary
		expect(inactiveClasses).toContain('border-transparent')
		expect(inactiveClasses).not.toContain('border-secondary')

		// the two states must not render identically (this is what the
		// tailwind-merge v3 upgrade broke: both ended up with the same
		// always-visible border, hiding which category was selected)
		expect(activeClasses).not.toEqual(inactiveClasses)
	})

	it('treats "View All" as active on the German homepage', async () => {
		const container = await AstroContainer.create()

		const html = await container.renderToString(Category, {
			props: { name: 'View All' },
			request: new Request('https://2lukas.de/')
		})

		expect(classesOf(html)).toContain('border-secondary')
	})

	it('keeps hover text readable in dark mode', async () => {
		const container = await AstroContainer.create()

		const classes = classesOf(
			await container.renderToString(Category, {
				props: { name: 'Projects', activeCategory: 'football-manager' }
			})
		)

		// hover:text-neutral-800 with no dark: variant made hover text nearly
		// black-on-black in dark mode; dark:hover:text-secondary-dark must be present
		expect(classes).toContain('dark:hover:text-secondary-dark')
	})
})
