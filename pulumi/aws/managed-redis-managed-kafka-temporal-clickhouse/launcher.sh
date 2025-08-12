#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to deploy a stack
deploy_stack() {
    local stack_name=$1
    local description=$2
    
    print_status "$BLUE" "\n📦 Deploying stack: $stack_name"
    print_status "$BLUE" "   $description"
    echo "   =================================================="
    
    # Select the stack
    pulumi stack select $stack_name 2>/dev/null || {
        print_status "$YELLOW" "   Stack $stack_name doesn't exist, creating..."
        pulumi stack init $stack_name || {
            print_status "$RED" "   Failed to create stack $stack_name"
            return 1
        }
    }
    
    # Deploy the stack
    print_status "$BLUE" "   🔄 Running 'pulumi up' for $stack_name..."
    
    if pulumi up --yes --stack $stack_name; then
        print_status "$GREEN" "   ✅ Stack $stack_name deployed successfully!"
    else
        print_status "$RED" "   ❌ Failed to deploy stack $stack_name"
        return 1
    fi
    
    return 0
}

# Function to destroy a stack
destroy_stack() {
    local stack_name=$1
    local description=$2
    
    print_status "$YELLOW" "\n🗑️  Destroying stack: $stack_name"
    print_status "$YELLOW" "   $description"
    echo "   =================================================="
    
    # Select the stack
    pulumi stack select $stack_name 2>/dev/null || {
        print_status "$YELLOW" "   Stack $stack_name doesn't exist, skipping..."
        return 0
    }
    
    # Destroy the stack
    print_status "$YELLOW" "   🔄 Running 'pulumi destroy' for $stack_name..."
    
    if pulumi destroy --yes --stack $stack_name; then
        print_status "$GREEN" "   ✅ Stack $stack_name destroyed successfully!"
    else
        print_status "$RED" "   ❌ Failed to destroy stack $stack_name"
        return 1
    fi
    
    return 0
}

# Main function
main() {
    local command=$1
    
    case $command in
        "up")
            print_status "$GREEN" "🚀 Starting deployment of all stacks...\n"
            
            # Deploy in order
            deploy_stack "base" "VPC, EKS, and networking infrastructure" || exit 1
            deploy_stack "secrets" "Shared secrets and configuration management" || exit 1
            
            # Deploy byoc-services and mds in parallel since they both only depend on base and secrets
            print_status "$BLUE" "\n⚡ Deploying byoc-services and mds in parallel..."
            deploy_stack "byoc-services" "Redis, Kafka, Temporal, and ClickHouse services" &
            BYOC_PID=$!
            deploy_stack "mds" "Managed Data Services" &
            MDS_PID=$!
            
            # Wait for both to complete
            wait $BYOC_PID
            BYOC_RESULT=$?
            wait $MDS_PID
            MDS_RESULT=$?
            
            if [[ $BYOC_RESULT -ne 0 || $MDS_RESULT -ne 0 ]]; then
                print_status "$RED" "One or more parallel deployments failed"
                exit 1
            fi
            
            print_status "$GREEN" "\n\n🎉 All stacks deployed successfully!"
            print_status "$GREEN" "\n📋 Stack deployment summary:"
            print_status "$GREEN" "   ✓ base: Deployed"
            print_status "$GREEN" "   ✓ secrets: Deployed"
            print_status "$GREEN" "   ✓ byoc-services: Deployed (parallel)"
            print_status "$GREEN" "   ✓ mds: Deployed (parallel)"
            ;;
            
        "destroy")
            print_status "$YELLOW" "🗑️  Starting destruction of all stacks...\n"
            print_status "$RED" "⚠️  WARNING: This will destroy all resources in reverse order!\n"
            
            # Confirm destruction
            read -p "Are you sure you want to destroy all stacks? (yes/no): " confirm
            if [[ $confirm != "yes" ]]; then
                print_status "$YELLOW" "Destruction cancelled."
                exit 0
            fi
            
            # Destroy in reverse order
            destroy_stack "mds" "Managed Data Services" || exit 1
            destroy_stack "byoc-services" "Redis, Kafka, Temporal, and ClickHouse services" || exit 1
            destroy_stack "secrets" "Shared secrets and configuration management" || exit 1
            destroy_stack "base" "VPC, EKS, and networking infrastructure" || exit 1
            
            print_status "$GREEN" "\n\n✅ All stacks destroyed successfully!"
            ;;
            
        "preview")
            print_status "$BLUE" "👁️  Previewing all stacks...\n"
            
            # Preview in order
            print_status "$BLUE" "\n📦 Previewing stack: base"
            pulumi preview --stack base || exit 1
            
            print_status "$BLUE" "\n📦 Previewing stack: byoc-services"
            pulumi preview --stack byoc-services || exit 1
            
            print_status "$BLUE" "\n📦 Previewing stack: mds"
            pulumi preview --stack mds || exit 1
            
            print_status "$GREEN" "\n\n✅ All stack previews completed!"
            ;;
            
        *)
            echo "Usage: $0 [up|destroy|preview]"
            echo "  up      - Deploy all stacks in order"
            echo "  destroy - Destroy all stacks in reverse order"
            echo "  preview - Preview changes for all stacks"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"