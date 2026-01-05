#!/bin/bash

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Iniciando configuração do ambiente...${NC}"

# 1. Verificar e Instalar NVM
if [ -d "$HOME/.nvm" ]; then
    echo -e "${GREEN}NVM já detectado em $HOME/.nvm${NC}"
else
    echo -e "${YELLOW}NVM não encontrado. Instalando...${NC}"
    if command -v curl >/dev/null 2>&1; then
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    elif command -v wget >/dev/null 2>&1; then
        wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    else
        echo -e "${RED}Erro: curl ou wget não encontrados. Instale um deles para prosseguir.${NC}"
        exit 1
    fi
fi

# 2. Carregar NVM no shell atual
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 3. Ler versão do .nvmrc e instalar
if [ -f ".nvmrc" ]; then
    NODE_VERSION=$(cat .nvmrc)
    echo -e "${YELLOW}Instalando/Verificando Node.js versão ${NODE_VERSION}...${NC}"
    nvm install "$NODE_VERSION"
    nvm use "$NODE_VERSION"
else
    echo -e "${RED}Arquivo .nvmrc não encontrado!${NC}"
    exit 1
fi

# 4. Verificar instalação
CURRENT_NODE=$(node -v)
echo -e "${GREEN}Ambiente configurado! Node atual: ${CURRENT_NODE}${NC}"
echo -e "${YELLOW}Agora você pode rodar 'npm run start' ou 'npm run build'.${NC}"
echo -e "${YELLOW}NOTA: Se este script não alterar seu shell atual permanentemente, rode 'source ~/.bashrc' ou abra um novo terminal.${NC}"
