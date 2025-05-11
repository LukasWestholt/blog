interface SiteConfig {
	site: string
	author: string
	title: string
	description: string
	lang: string
	ogLocale: string
	shareMessage: string
	paginationSize: number
}

export const siteConfig: SiteConfig = {
	site: 'https://2lukas.de/', // Write here your website url
	author: 'Lukas Westholt and Lukas Ruminski', // Site author
	title: '2Lukas', // Site title.
	description:
		'2Lukas is a laid-back tech blog where two computer scientists named Lukas share tutorials, insights, and witty takes on technology, coding, and the digital world around us.',
	lang: 'en-GB',
	ogLocale: 'en_GB',
	shareMessage: 'Share this post', // Message to share a post on social media
	paginationSize: 6 // Number of posts per page
}
