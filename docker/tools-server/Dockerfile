# Target server for Coolify, the local stand-in for the real tools server (task 28): Docker in Docker
# with sshd, so Coolify reaches it the same way as a remote machine.
FROM docker:29.9.3-dind

# git, curl and jq are Coolify's server prerequisites (ValidatePrerequisites).
RUN apk add --no-cache openssh-server bash curl git jq \
  && sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/; s/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config

COPY entrypoint.sh /usr/local/bin/tools-server-entrypoint.sh

ENTRYPOINT ["tools-server-entrypoint.sh"]
