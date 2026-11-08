#!/bin/sh
set -eu

# Host keys live on the /data volume, so recreating the container keeps the server identity.
mkdir -p /data/ssh-host-keys
for type in ed25519 rsa; do
  key=/data/ssh-host-keys/ssh_host_${type}_key
  [ -f "$key" ] || ssh-keygen -q -t "$type" -N '' -f "$key"
  sed -i "\|^HostKey $key|d" /etc/ssh/sshd_config
  echo "HostKey $key" >>/etc/ssh/sshd_config
done

mkdir -p /root/.ssh
chmod 700 /root/.ssh
cp /run/tools-server/authorized_keys /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

/usr/sbin/sshd

exec dockerd-entrypoint.sh "$@"
