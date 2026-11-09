#!/usr/bin/env bash
# Starts the local servers the end-to-end tests use (Debian/Ubuntu, run as root):
#   Dovecot  IMAPS 10993, IMAP 10143, POP3S 10995, POP3 10110  users user1..user12@test.local / pass1..pass12
#   Radicale CalDAV http://127.0.0.1:5232                       users user1..user12 / pass1..pass12
# The SMTP side is provided by test/helpers/servers.js inside the tests.
set -euo pipefail

ROOT=/srv/sbtest
mkdir -p "$ROOT"

if ! command -v dovecot >/dev/null; then
  apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq dovecot-imapd dovecot-pop3d
fi
if ! command -v radicale >/dev/null; then
  pip install -q radicale || pip install -q --break-system-packages radicale
fi

# --- Dovecot -------------------------------------------------------------------------------------
id vmail >/dev/null 2>&1 || useradd -r -M -s /usr/sbin/nologin vmail
mkdir -p "$ROOT/mail" "$ROOT/home" /run/sbdove
chown -R vmail:vmail "$ROOT/mail" "$ROOT/home"
chmod 755 "$ROOT"
: > "$ROOT/users"
for i in $(seq 1 12); do echo "user$i@test.local:{PLAIN}pass$i::::::" >> "$ROOT/users"; done
echo "alice@test.local:{PLAIN}alicepw::::::" >> "$ROOT/users"
echo "bob@test.local:{PLAIN}bobpw::::::" >> "$ROOT/users"
chmod 644 "$ROOT/users"
CERT=/etc/dovecot/private/dovecot.pem
KEY=/etc/dovecot/private/dovecot.key
if [ ! -f "$CERT" ]; then
  mkdir -p /etc/dovecot/private
  openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj "/CN=localhost" -keyout "$KEY" -out "$CERT" >/dev/null 2>&1
fi
cat > "$ROOT/dovecot.conf" <<EOF
protocols = imap pop3
listen = 127.0.0.1
base_dir = /run/sbdove
state_dir = /run/sbdove
log_path = $ROOT/dovecot.log
ssl = yes
ssl_cert = <$CERT
ssl_key = <$KEY
disable_plaintext_auth = no
auth_mechanisms = plain login
mail_location = maildir:$ROOT/mail/%u
first_valid_uid = 1
passdb {
  driver = passwd-file
  args = scheme=PLAIN username_format=%u $ROOT/users
}
userdb {
  driver = static
  args = uid=$(id -u vmail) gid=$(id -g vmail) home=$ROOT/home/%u
}
namespace inbox {
  inbox = yes
  separator = /
  mailbox Sent {
    special_use = \\Sent
    auto = create
  }
  mailbox Trash {
    special_use = \\Trash
    auto = create
  }
  mailbox Drafts {
    special_use = \\Drafts
    auto = create
  }
  mailbox Archive {
    special_use = \\Archive
    auto = create
  }
  mailbox Junk {
    special_use = \\Junk
    auto = create
  }
}
service imap-login {
  inet_listener imap {
    port = 10143
  }
  inet_listener imaps {
    port = 10993
    ssl = yes
  }
}
service pop3-login {
  inet_listener pop3 {
    port = 10110
  }
  inet_listener pop3s {
    port = 10995
    ssl = yes
  }
}
protocol imap {
  mail_max_userip_connections = 60
}
EOF
doveadm -c "$ROOT/dovecot.conf" stop >/dev/null 2>&1 || true
pkill -f "dovecot -c $ROOT/dovecot.conf" 2>/dev/null || true
sleep 0.5
dovecot -c "$ROOT/dovecot.conf"

# --- Radicale (CalDAV) -----------------------------------------------------------------------------
mkdir -p "$ROOT/radicale/collections"
: > "$ROOT/radicale/users"
for i in $(seq 1 12); do echo "user$i:pass$i" >> "$ROOT/radicale/users"; done
cat > "$ROOT/radicale/config" <<EOF
[server]
hosts = 127.0.0.1:5232
[auth]
type = htpasswd
htpasswd_filename = $ROOT/radicale/users
htpasswd_encryption = plain
[storage]
filesystem_folder = $ROOT/radicale/collections
[logging]
level = warning
EOF
pkill -f "radicale --config $ROOT/radicale/config" 2>/dev/null || true
sleep 0.3
nohup radicale --config "$ROOT/radicale/config" > "$ROOT/radicale/radicale.log" 2>&1 &

for _ in $(seq 1 30); do
  if (exec 3<>/dev/tcp/127.0.0.1/10993) 2>/dev/null && (exec 3<>/dev/tcp/127.0.0.1/5232) 2>/dev/null; then
    echo "Test servers are up: IMAPS 10993, POP3S 10995, CalDAV 5232"
    exit 0
  fi
  sleep 0.3
done
echo "Servers did not come up; see $ROOT/dovecot.log and $ROOT/radicale/radicale.log" >&2
exit 1
