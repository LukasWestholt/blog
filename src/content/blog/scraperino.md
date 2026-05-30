---
title: 'Scraperino'
description: 'Was ist Scraperino'
pubDate: 'May 30 2026'
heroImage: '../../assets/images/banner.jpg'
author: 'Lukas Ruminski'
category: 'Projects'
tags: ['Projects', 'Scraperino']
---

## Was ist Scraperino?

_Scraperino_ ist eine umfassende Full-Stack-Webanwendung, die entwickelt wurde, um Produktdaten und Angebote von Online-Marktplätzen – speziell _eBay_ (weltweit) und _Kleinanzeigen_ – automatisiert auszulesen (Scraping).
Die Architektur besteht aus einem Python-Backend (betrieben mit FastAPI und Playwright) und einem React-Frontend (betrieben mit Vite und Node.js).

### Features

Nutzer können nach mehreren Suchbegriffen gleichzeitig suchen, genaue Parameter (wie Preisgrenzen oder Zustände) vorgeben und das System extrahiert dann alle passenden Angebote. Am Ende werden die gesammelten, aufbereiteten Daten in einer übersichtlichen Excel-Datei bereitgestellt.

- Multi-Plattform & Regionen-Unterstützung
- - Unterstützt Kleinanzeigen (.de)
- - Unterstützt eBay in zahlreichen internationalen Regionen (DE, US, UK, AT, CH, FR, IT, ES, etc.) inkl. Währungsumrechnungslogik
- Detaillierte Filter & Suchkriterien
- - Preisfilter: Minimal- und Maximalpreis können festgelegt werden
- - Zustandsfilter: Beschränkung auf Neu, Gebraucht, Generalüberholt oder Defekt/Ersatzteil
- - Angebotsformate (eBay): Filterung nach Auktionen, Sofort-Kaufen oder Preisvorschlägen
- - Angebotsstatus (eBay): Suche nach aktuell aktiven Angeboten, aber auch nach verkauften oder beendeten Artikeln (nützlich für Preisrecherchen)
- - Verbotene Wörter (Blacklist): Begriffe, die im Titel vorkommen, führen zum sofortigen Aussortieren des Artikels
- Duplikate werden herausgefiltert
- Intelligentes Anti-Bot-Management & Captcha-Handling
- Live-Tracking & Echtzeit-Logs
- Parallelverarbeitung für mehr Geschwindigkeit
- Mehrsprachigkeit, diese auch einfach erweiterbar

### Ablauf

Das System nutzt Playwright mit "Stealth"-Einstellungen, um nicht direkt als Bot erkannt zu werden.
Live-View & Eingriff: Erkennt das System Captchas (z. B. DataDome bei Kleinanzeigen) oder Blockaden (Akamai oder Login-Pflicht bei eBay), bricht es nicht sofort ab. Wenn der Nutzer den "Live-View" aktiviert hat, pausiert der Scraper für 5 Minuten und warnt den Nutzer über das Frontend, das Problem im Browser manuell zu lösen (z.B. ein Captcha wegzuklicken). Danach arbeitet das Skript nahtlos weiter.
Dank WebSockets erhält das React-Frontend in Echtzeit Updates aus dem Python-Backend.
Der Nutzer sieht einen Live-Tracker, der genau zeigt, welche Seite gerade durchsucht wird, wie viele Treffer ("Hits") gefunden, wie viele aussortiert ("gefiltert") und wie viele Duplikate ignoriert wurden.
Suchanfragen (Queries) und Plattformen werden gebündelt und mithilfe von asynchronen Tasks (Asyncio) und parallel geöffneten Browser-Tabs bearbeitet. Die maximale Anzahl gleichzeitiger Tabs (max_tabs) kann begrenzt werden, um Systemauslastungen und IP-Sperren zu managen.

Alle Suchergebnisse werden bereinigt und in eine .xlsx-Datei (Excel) geschrieben (excel_writer.py).
Die Datei enthält klickbare Links, vorformatierte Währungen/Preise, Gesamtkosten (Preis + Versand) und sauber getrennte Spalten (Titel, Plattform, Zustand, Typ, Verhandelbar).
Automatische Deduplizierung stellt sicher, dass exakt gleiche Links nicht mehrfach in der Excel-Tabelle landen.
Zweisprachigkeit (Lokalisierung)

Die Anwendung (Logs, UI, Excel-Spalten) ist vollständig in Deutsch und Englisch verfügbar (localization.py).

### Zusammenfassung

Zusammenfassend ist Scraperino ein sehr fortgeschrittener, asynchroner Web-Scraper mit Fokus auf Robustheit (Captcha-Handling) und Benutzerfreundlichkeit (visuelles Interface, Echtzeit-Feedback, formatierte Exporte).
