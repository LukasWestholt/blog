---
title: 'Scraperino'
description: 'What is Scraperino'
pubDate: 'May 30 2026'
heroImage: '../../../assets/images/banner.jpg'
author: 'Lukas Ruminski'
category: 'Projects'
tags: ['Projects', 'Scraperino']
---

## What is Scraperino?

_Scraperino_ is a comprehensive full-stack web application designed to automatically extract (scrape) product data and listings from online marketplaces—specifically _eBay_ (worldwide) and _Kleinanzeigen_.
The architecture consists of a Python backend (powered by FastAPI and Playwright) and a React frontend (powered by Vite and Node.js).

### Features

Users can search for multiple keywords simultaneously, specify exact parameters (such as price ranges or conditions), and the system then extracts all matching listings. Finally, the collected and processed data is provided in a clear Excel file.

- Multi-platform & regional support
- - Supports Kleinanzeigen (.de)
- - Supports eBay in numerous international regions (DE, US, UK, AT, CH, FR, IT, ES, etc.), including currency conversion logic
- Detailed Filters & Search Criteria
- - Price Filter: Minimum and maximum prices can be set
- - Condition Filter: Limit to New, Used, Refurbished, or Defective/Spare Parts
- - Listing Formats (eBay): Filter by Auctions, Buy It Now, or Price Suggestions
- - Listing status (eBay): Search for currently active listings, as well as sold or ended items (useful for price research)
- - Prohibited words (blacklist): Terms appearing in the title result in the item being immediately filtered out
- Duplicates are filtered out
- Intelligent anti-bot management & CAPTCHA handling
- Live tracking & real-time logs
- Parallel processing for increased speed
- Multilingual support, easily expandable

### Process

The system uses Playwright with “Stealth” settings to avoid being immediately detected as a bot.
Live View & Intervention: If the system detects captchas (e.g., DataDome on classifieds sites) or blockages (Akamai or mandatory login on eBay), it does not stop immediately. If the user has enabled “Live View,” the scraper pauses for 5 minutes and alerts the user via the frontend to manually resolve the issue in the browser (e.g., by clicking through a CAPTCHA). Afterward, the script continues running seamlessly.
Thanks to WebSockets, the React frontend receives real-time updates from the Python backend.
The user sees a live tracker that shows exactly which page is currently being searched, how many hits were found, how many were filtered out, and how many duplicates were ignored.
Search queries and platforms are bundled and processed using asynchronous tasks (Asyncio) and parallel browser tabs. The maximum number of concurrent tabs (max_tabs) can be limited to manage system load and IP blocks.

All search results are cleaned up and written to an .xlsx file (Excel) (excel_writer.py).
The file contains clickable links, preformatted currencies/prices, total costs (price + shipping), and neatly separated columns (title, platform, condition, type, negotiable).
Automatic deduplication ensures that exactly identical links do not appear multiple times in the Excel spreadsheet.
Bilingual Support (Localization)

The application (logs, UI, Excel columns) is fully available in German and English (localization.py).

### Summary

In summary, Scraperino is a highly advanced, asynchronous web scraper with a focus on robustness (Captcha handling) and user-friendliness (visual interface, real-time feedback, formatted exports).
