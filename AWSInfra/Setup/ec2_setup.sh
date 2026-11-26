#!/bin/bash
set -euxo pipefail

# Update system
apt-get update -y
apt-get install -y curl wget gnupg apt-transport-https

# --------------------------------
# 1. Install Node.js 22
# --------------------------------

curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Install PM2
npm install -g pm2

# Configure PM2 startup
env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

# --------------------------------
# 2. Install Prometheus + Node Exporter
# --------------------------------

apt-get install -y prometheus prometheus-node-exporter

systemctl enable prometheus
systemctl restart prometheus

systemctl enable prometheus-node-exporter
systemctl restart prometheus-node-exporter

# --------------------------------
# 3. Install Grafana
# --------------------------------

mkdir -p /etc/apt/keyrings

wget -q -O /etc/apt/keyrings/grafana.asc \
https://apt.grafana.com/gpg-full.key

chmod 644 /etc/apt/keyrings/grafana.asc

echo "deb [signed-by=/etc/apt/keyrings/grafana.asc] https://apt.grafana.com stable main" \
> /etc/apt/sources.list.d/grafana.list

apt-get update -y
apt-get install -y grafana

systemctl enable grafana-server
systemctl start grafana-server

# --------------------------------
# 4. Display Versions
# --------------------------------

node -v
npm -v
pm2 -v
prometheus --version
prometheus-node-exporter --version
grafana-server -v

echo "All installations completed successfully!"



