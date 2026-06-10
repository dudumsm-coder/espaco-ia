#!/bin/bash
set -e

echo "=== 1/6 Atualizando sistema ==="
apt-get update && apt-get upgrade -y

echo "=== 2/6 Instalando Docker ==="
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

echo "=== 3/6 Instalando nginx + certbot ==="
apt-get install -y nginx certbot python3-certbot-nginx

echo "=== 4/6 Clonando repositório ==="
git clone https://github.com/dudumsm-coder/espaco-ia.git /opt/espaco-ia
cd /opt/espaco-ia/deploy

echo "=== 5/6 Configurando nginx ==="
cp nginx.conf /etc/nginx/sites-available/api.espacoia.com.br
ln -sf /etc/nginx/sites-available/api.espacoia.com.br /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo ""
echo "=== PRÓXIMOS PASSOS MANUAIS ==="
echo "1. Crie o arquivo de variáveis:"
echo "   cp /opt/espaco-ia/deploy/.env.example /opt/espaco-ia/deploy/.env"
echo "   nano /opt/espaco-ia/deploy/.env"
echo ""
echo "2. Suba os containers:"
echo "   cd /opt/espaco-ia/deploy"
echo "   docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "3. Obtenha o certificado SSL:"
echo "   certbot --nginx -d api.espacoia.com.br"
echo ""
echo "4. Teste:"
echo "   curl https://api.espacoia.com.br/ping"
