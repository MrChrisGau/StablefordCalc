#!/usr/bin/env bash
# Einmaliges Root-Setup für PocketBase auf dem NUC. Idempotent, startet den Dienst nicht.
# Aufruf: sudo bash /home/pbadmin/setup-root.sh
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Bitte mit sudo ausführen." >&2
  exit 1
fi

# Dienst-Benutzer ohne Login und ohne Passwort
id -u pocketbase >/dev/null 2>&1 || useradd --system --home-dir /opt/pocketbase --shell /usr/sbin/nologin pocketbase

# Programm und Migrationen darf pbadmin austauschen, die Daten gehören nur dem Dienst
install -d -o pbadmin -g pocketbase -m 750 /opt/pocketbase /opt/pocketbase/bin /opt/pocketbase/pb_migrations
install -d -o pocketbase -g pocketbase -m 750 /opt/pocketbase/pb_data

# Dienstdatei von root installiert: pbadmin kann sie danach nicht mehr ändern
install -o root -g root -m 644 /home/pbadmin/pocketbase.service /etc/systemd/system/pocketbase.service
systemctl daemon-reload

echo "Fertig. PocketBase ist vorbereitet, aber noch nicht gestartet."
