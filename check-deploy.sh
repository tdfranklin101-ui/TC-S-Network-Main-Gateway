#!/bin/bash

# The Current-See Deployment Check Tool
# This script verifies that the deployment is properly configured

# Colors for better output
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   The Current-See Deployment Check Tool    ${NC}"
echo -e "${GREEN}============================================${NC}"

# Step 1: Check deployment configuration
echo -e "\n${YELLOW}Checking deployment configuration...${NC}"

if [ ! -L "main.js" ]; then
  echo -e "${RED}Error: main.js is not a symbolic link${NC}"
  echo -e "${YELLOW}Fix: Run 'ln -sf deploy-simple.js main.js'${NC}"
else
  target=$(readlink main.js)
  if [ "$target" != "deploy-simple.js" ]; then
    echo -e "${RED}Error: main.js is not linked to deploy-simple.js${NC}"
    echo -e "${YELLOW}Current target: $target${NC}"
    echo -e "${YELLOW}Fix: Run 'ln -sf deploy-simple.js main.js'${NC}"
  else
    echo -e "${GREEN}✓${NC} main.js correctly linked to deploy-simple.js"
  fi
fi

# Step 2: Check server file
if [ ! -f "deploy-simple.js" ]; then
  echo -e "${RED}Error: deploy-simple.js not found${NC}"
  echo -e "${YELLOW}Fix: Create the deployment server file${NC}"
else
  echo -e "${GREEN}✓${NC} deploy-simple.js exists"
fi

# Step 3: Check for a running server
server_running=$(ps -ef | grep "node.*deploy-simple.js" | grep -v grep | wc -l)
if [ $server_running -eq 0 ]; then
  echo -e "${YELLOW}Warning: No deployment server is currently running${NC}"
  echo -e "${YELLOW}Fix: Run 'node deploy-simple.js' to start the server${NC}"
else
  echo -e "${GREEN}✓${NC} Deployment server is running"
fi

# Step 4: Check includes directory
if [ ! -d "public/includes" ]; then
  echo -e "${RED}Error: includes directory not found${NC}"
  echo -e "${YELLOW}Fix: Create 'public/includes' directory${NC}"
else
  echo -e "${GREEN}✓${NC} includes directory exists"
  
  # Check header and footer files
  if [ ! -f "public/includes/header.html" ]; then
    echo -e "${RED}Error: header.html not found${NC}"
    echo -e "${YELLOW}Fix: Create the header file in the includes directory${NC}"
  else
    echo -e "${GREEN}✓${NC} header.html exists"
  fi
  
  if [ ! -f "public/includes/footer.html" ]; then
    echo -e "${RED}Error: footer.html not found${NC}"
    echo -e "${YELLOW}Fix: Create the footer file in the includes directory${NC}"
  else
    echo -e "${GREEN}✓${NC} footer.html exists"
  fi
fi

# Step 5: Check for replit deployment configuration
if [ -f "DEPLOYMENT.md" ]; then
  echo -e "${GREEN}✓${NC} Deployment documentation found"
else
  echo -e "${YELLOW}Warning: DEPLOYMENT.md not found${NC}"
  echo -e "${YELLOW}Fix: Create deployment documentation for reference${NC}"
fi

# Step 6: Summary
echo -e "\n${GREEN}============================================${NC}"
echo -e "${GREEN}             Deployment Summary             ${NC}"
echo -e "${GREEN}============================================${NC}"

total_errors=$(grep -c "${RED}Error" <(echo "$output"))
total_warnings=$(grep -c "${YELLOW}Warning" <(echo "$output"))

if [ $total_errors -eq 0 ] && [ $total_warnings -eq 0 ]; then
  echo -e "${GREEN}All checks passed! The deployment is properly configured.${NC}"
  echo -e "${GREEN}You can proceed with deployment on Replit.${NC}"
elif [ $total_errors -eq 0 ]; then
  echo -e "${YELLOW}Deployment configuration has warnings but no critical errors.${NC}"
  echo -e "${YELLOW}You may proceed with caution.${NC}"
else
  echo -e "${RED}Deployment configuration has errors that need to be fixed.${NC}"
  echo -e "${RED}Please address the issues above before deploying.${NC}"
fi

echo -e "\n${YELLOW}Ready to deploy?${NC}"
echo -e "1. Click the 'Deploy' button in the Replit interface"
echo -e "2. Set up your custom domain (www.thecurrentsee.org) after deployment"
echo -e "3. Verify that the site works correctly after deployment"

exit 0