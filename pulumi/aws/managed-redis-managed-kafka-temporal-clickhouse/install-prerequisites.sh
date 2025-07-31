#!/bin/bash

# BYOC Prerequisites Installation Script
# This script installs all required tools for BYOC deployment on macOS/Linux

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
else
    echo -e "${RED}Unsupported OS: $OSTYPE${NC}"
    exit 1
fi

echo -e "${GREEN}Detected OS: $OS${NC}"
echo -e "${GREEN}Starting BYOC prerequisites installation...${NC}\n"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install AWS CLI
install_aws_cli() {
    echo -e "${YELLOW}Installing AWS CLI...${NC}"

    if command_exists aws; then
        echo -e "${GREEN}AWS CLI is already installed: $(aws --version)${NC}"
        return 0
    fi

    if [[ "$OS" == "macos" ]]; then
        if command_exists brew; then
            brew install awscli
        else
            echo -e "${RED}Homebrew not found. Please install Homebrew first: https://brew.sh${NC}"
            exit 1
        fi
    elif [[ "$OS" == "linux" ]]; then
        curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
        unzip awscliv2.zip
        sudo ./aws/install
        rm -rf awscliv2.zip aws/
    fi
}

# Function to install Pulumi
install_pulumi() {
    echo -e "${YELLOW}Installing Pulumi...${NC}"

    if command_exists pulumi; then
        echo -e "${GREEN}Pulumi is already installed: $(pulumi version)${NC}"
        return 0
    fi

    if [[ "$OS" == "macos" ]] && command_exists brew; then
        brew install pulumi
    else
        curl -fsSL https://get.pulumi.com | sh

        # Add to PATH for current session
        export PATH=$PATH:$HOME/.pulumi/bin

        # Add to shell profile
        if [[ -f "$HOME/.bashrc" ]]; then
            echo 'export PATH=$PATH:$HOME/.pulumi/bin' >> "$HOME/.bashrc"
        fi
        if [[ -f "$HOME/.zshrc" ]]; then
            echo 'export PATH=$PATH:$HOME/.pulumi/bin' >> "$HOME/.zshrc"
        fi

        echo -e "${YELLOW}Added Pulumi to PATH. Please restart your shell or run: export PATH=\$PATH:\$HOME/.pulumi/bin${NC}"
    fi
}

# Function to install Node.js and pnpm
install_nodejs_pnpm() {
    echo -e "${YELLOW}Installing Node.js and pnpm...${NC}"

    if command_exists node; then
        echo -e "${GREEN}Node.js is already installed: $(node --version)${NC}"
    else
        if [[ "$OS" == "macos" ]]; then
            if command_exists brew; then
                brew install node
            else
                echo -e "${RED}Homebrew not found. Please install Homebrew first: https://brew.sh${NC}"
                exit 1
            fi
        elif [[ "$OS" == "linux" ]]; then
            curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
            sudo apt-get install -y nodejs
        fi
    fi

    if command_exists pnpm; then
        echo -e "${GREEN}pnpm is already installed: $(pnpm --version)${NC}"
    else
        npm install -g pnpm
    fi
}

# Function to install kubectl
install_kubectl() {
    echo -e "${YELLOW}Installing kubectl...${NC}"

    if command_exists kubectl; then
        echo -e "${GREEN}kubectl is already installed: $(kubectl version --client --short 2>/dev/null || kubectl version --client)${NC}"
        return 0
    fi

    if [[ "$OS" == "macos" ]]; then
        if command_exists brew; then
            brew install kubectl
        else
            echo -e "${RED}Homebrew not found. Please install Homebrew first: https://brew.sh${NC}"
            exit 1
        fi
    elif [[ "$OS" == "linux" ]]; then
        curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
        chmod +x kubectl
        sudo mv kubectl /usr/local/bin/
    fi
}

# Main installation flow
main() {
    echo -e "${GREEN}=== Installing Prerequisites ===${NC}\n"

    # Install each component
    install_aws_cli
    echo ""

    install_pulumi
    echo ""

    install_nodejs_pnpm
    echo ""

    install_kubectl
    echo ""

    # Verify installations
    echo -e "${GREEN}=== Verifying Installations ===${NC}"

    echo -e "\n${YELLOW}Checking installed versions:${NC}"

    if command_exists aws; then
        echo -e "✓ AWS CLI: $(aws --version)"
    else
        echo -e "${RED}✗ AWS CLI not found${NC}"
    fi

    if command_exists pulumi; then
        echo -e "✓ Pulumi: $(pulumi version 2>/dev/null || echo 'installed')"
    else
        echo -e "${RED}✗ Pulumi not found${NC}"
    fi

    if command_exists node; then
        echo -e "✓ Node.js: $(node --version)"
    else
        echo -e "${RED}✗ Node.js not found${NC}"
    fi

    if command_exists pnpm; then
        echo -e "✓ pnpm: $(pnpm --version)"
    else
        echo -e "${RED}✗ pnpm not found${NC}"
    fi

    if command_exists kubectl; then
        echo -e "✓ kubectl: $(kubectl version --client --short 2>/dev/null || echo 'installed')"
    else
        echo -e "${RED}✗ kubectl not found${NC}"
    fi

    echo -e "\n${GREEN}=== Next Steps ===${NC}"
    echo -e "1. Configure AWS credentials:"
    echo -e "   ${YELLOW}aws configure${NC}"
    echo -e ""
    echo -e "2. Login to Pulumi with API token:"
    echo -e "   ${YELLOW}PULUMI_ACCESS_TOKEN=<your-token> pulumi login --cloud-url https://api.pulumi.com${NC}"
    echo -e ""
    echo -e "3. Choose your example and start deployment:"
    echo -e "   ${YELLOW}cd boreal-byoc-examples${NC}"
    echo -e ""
    echo -e "${GREEN}Prerequisites installation complete!${NC}"
    
    # Check if PATH needs to be reloaded
    if [[ ! $(command -v pulumi) ]] && [[ -f "$HOME/.pulumi/bin/pulumi" ]]; then
        echo -e "\n${YELLOW}Note: Please restart your shell or run:${NC}"
        echo -e "${YELLOW}export PATH=\$PATH:\$HOME/.pulumi/bin${NC}"
    fi
}

# Run main function
main
