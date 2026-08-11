---
title: 'Macht KI-Assistenz Open-Source-Code messbar schlechter?'
description: 'Eine Mining-Studie zu GitHub Copilot, Cursor und Claude Code an 571 Repositories, und warum das klarste Ergebnis ein Nullbefund ist.'
pubDate: 'Jul 07 2026'
author: 'Lukas Westholt'
category: 'Research'
tags: ['Copilot', 'Code Quality', 'Mining Study', 'Empirical Software Engineering']
---

Seit 2022 sind KI-Coding-Assistenten wie GitHub Copilot, Cursor und Claude Code
fester Teil der Open-Source-Entwicklung. Dass sie schneller machen, ist gut
belegt. Ob der Code dadurch schlechter (oder besser) wird, ist es nicht. Genau
diese Lücke habe ich in meiner Seminararbeit an der Universität Leipzig untersucht.

## Der Aufbau

Ich habe 272 Repositories, die nachweislich einen KI-Assistenten eingesetzt
haben, mit 299 Kontroll-Repositories ohne solches Signal verglichen. Das
Adoptionssignal stammt aus einer dreistufigen Hierarchie: Konfigurationsdateien
wie `CLAUDE.md` (stark), KI-Co-Authorship in Commit-Trailern (mittel) und
Schlüsselwörter in Commit-Nachrichten (schwach, nur als Sensitivitätsanalyse).
Insgesamt deckt die Hierarchie 17 Assistenten ab.

Weil jedes Projekt seinen eigenen Adoptionszeitpunkt bekommt, konnte ich pro
Repository vier Snapshots ziehen (rund ein halbes Jahr vor und nach dem Signal)
und daraus eine gestaffelte Interrupted Time Series mit Difference-in-Differences
gegen die Kontrollgruppe rechnen. Pro Snapshot habe ich 15 statische
Qualitätsmetriken gemessen, von zyklomatischer Komplexität über Lint-Warnungen
bis zur Testdichte.

## Das Ergebnis

Für die beiden Kernfragen gibt es keinen nachweisbaren Effekt. Die
Difference-in-Differences für die durchschnittliche zyklomatische Komplexität
liegt bei -0,04 (95%-Konfidenzintervall [-0,13, 0,04]), für den Anteil der
Bugfix-Commits bei 0,03 ([-0,02, 0,09]). Beide Intervalle schließen die Null
ein, und es gibt keine Variation nach Sprache (Python vs. TypeScript) oder
Aktivitätsniveau.

Interessanter sind die explorativen Befunde. Adoptierende Projekte testen und
dokumentieren etwas mehr: Testdichte, Testanzahl und (in Python) die
Docstring-Abdeckung steigen, die Parameter pro Funktion sinken leicht. Alle
Effektstärken bleiben aber klein (größtes Cliff's Delta 0,27). Und bei mehreren
dieser Metriken liefen die beiden Gruppen schon vor der Adoption auseinander. Ich
lese sie deshalb als hypothesengenerierend, nicht als Beleg.

Ein scheinbarer Ausreißer: die maximale Komplexität steigt deutlich. Das ist aber
eine Ordnungsstatistik, die mit der Codebasis mitwächst. Der normalisierte Anteil
komplexer Funktionen bleibt unverändert, also steckt dahinter Wachstum, keine
echte Verkomplizierung.

## Was ich mitnehme

KI-Assistenz macht Open-Source-Code in den messbaren statischen Metriken weder
klar besser noch schlechter. Das ist ein unspektakuläres, aber ehrliches
Ergebnis. Die größte Schwäche bleibt die unscharfe Behandlungsgrenze: Ich messe,
ab wann ein Projekt KI-Nutzung sichtbar macht, nicht ab wann es sie wirklich
nutzt. Der nächste Schritt wäre, von der Projektebene auf die einzelnen
KI-zugeschriebenen Änderungen herunterzugehen.
