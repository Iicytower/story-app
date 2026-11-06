# A stand-in for a fresh Mikrus VPS (task 28): Ubuntu 24.04 with systemd and sshd, root login by
# key only, no Docker. scripts/tools.ts remote installs Docker and Coolify on it as on the real one.
FROM ubuntu:24.04

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    systemd systemd-sysv openssh-server curl ca-certificates git jq iproute2 \
  && rm -rf /var/lib/apt/lists/* \
  && sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/; s/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config \
  && systemctl enable ssh \
  && mkdir -p /root/.ssh && chmod 700 /root/.ssh

COPY authorized-keys.service /etc/systemd/system/authorized-keys.service
RUN systemctl enable authorized-keys.service

STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
