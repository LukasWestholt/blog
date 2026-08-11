# Preview-Deployment einrichten

Nach dem Merge dieser Änderungen werden alle Branches außer `main` automatisch unter
`https://2lukas.de/preview/<branch-name>/` deployt.

## 1. GitHub Secret anlegen

Gehe zu: **github.com/LukasWestholt/blog → Settings → Secrets and variables → Actions → New repository secret**

| Name | Wert |
|---|---|
| `PREVIEW_PASSWORD` | dein gewünschtes Passwort für den Passwortschutz |

HTTP Basic Auth: Benutzername ist immer `preview`.

## 2. Neue GitHub-Variable anlegen: SERVER_FS_ROOT

Gehe zu: **github.com/LukasWestholt/blog → Settings → Secrets and variables → Actions → Variables → New repository variable**

| Name | Wert |
|---|---|
| `SERVER_FS_ROOT` | absoluter Dateisystem-Pfad auf dem Strato-Server |

Apache braucht diesen Pfad um die `.htpasswd`-Datei aufzulösen — der SFTP-Pfad (`SERVER_TARGET = "/"`) reicht dafür nicht.

**Typischer Strato-Pfad:** `/www/htdocs/w12345678/`  
Den genauen Wert findest du per SSH mit `pwd` im Home-Verzeichnis,
oder in der Strato-Verwaltung unter **Hosting-Paket → FTP-Zugangsdaten** (Spalte „Verzeichnis").

## 3. Testen

Einen Branch pushen (z.B. `more-articles`) und den Workflow unter
**github.com/LukasWestholt/blog → Actions → Preview Deploy** beobachten.

Danach erreichbar unter: `https://2lukas.de/preview/more-articles/`
