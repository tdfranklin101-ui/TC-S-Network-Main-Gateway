#!/bin/bash

# The Current-See Deployment Script
# This script prepares and configures the website for deployment on Replit

# Colors for better output
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}   The Current-See Deployment Tool    ${NC}"
echo -e "${GREEN}======================================${NC}"

# Step 1: Check if necessary files exist
echo -e "\n${YELLOW}Checking required files...${NC}"

if [ ! -d "public" ]; then
  echo -e "${RED}Error: 'public' directory not found${NC}"
  exit 1
fi

if [ ! -d "public/includes" ]; then
  echo -e "${RED}Error: 'public/includes' directory not found${NC}"
  exit 1
fi

if [ ! -f "public/includes/header.html" ]; then
  echo -e "${RED}Error: header.html not found in includes directory${NC}"
  exit 1
fi

if [ ! -f "public/includes/footer.html" ]; then
  echo -e "${RED}Error: footer.html not found in includes directory${NC}"
  exit 1
fi

if [ ! -f "public/js/language-translator.js" ]; then
  echo -e "${RED}Error: language-translator.js not found${NC}"
  exit 1
fi

if [ ! -f "public/js/language-translator-loader.js" ]; then
  echo -e "${RED}Error: language-translator-loader.js not found${NC}"
  exit 1
fi

if [ ! -f "public/js/voice-assistant.js" ]; then
  echo -e "${RED}Error: voice-assistant.js not found${NC}"
  exit 1
fi

if [ ! -f "public/js/voice-assistant-loader.js" ]; then
  echo -e "${RED}Error: voice-assistant-loader.js not found${NC}"
  exit 1
fi

if [ ! -f "deploy-simple.js" ]; then
  echo -e "${RED}Error: deploy-simple.js server file not found${NC}"
  exit 1
fi

echo -e "${GREEN}✓${NC} All required files found"

# Step 2: Link the deployment server to main.js
echo -e "\n${YELLOW}Configuring deployment server...${NC}"
ln -sf deploy-simple.js main.js
echo -e "${GREEN}✓${NC} Linked deploy-simple.js to main.js"

# Step 3: Verify placeholder comments in HTML files
echo -e "\n${YELLOW}Verifying HTML placeholders...${NC}"
missing_placeholders=0

for htmlfile in public/*.html; do
  basename=$(basename "$htmlfile")
  header_found=$(grep -c "<!-- HEADER_PLACEHOLDER -->" "$htmlfile")
  footer_found=$(grep -c "<!-- FOOTER_PLACEHOLDER -->" "$htmlfile")
  
  if [ $header_found -eq 0 ]; then
    echo -e "${RED}Warning: Header placeholder missing in ${basename}${NC}"
    missing_placeholders=$((missing_placeholders + 1))
  fi
  
  if [ $footer_found -eq 0 ]; then
    echo -e "${RED}Warning: Footer placeholder missing in ${basename}${NC}"
    missing_placeholders=$((missing_placeholders + 1))
  fi
done

if [ $missing_placeholders -eq 0 ]; then
  echo -e "${GREEN}✓${NC} All HTML files have proper placeholders"
else
  echo -e "${YELLOW}Warning: $missing_placeholders placeholders missing${NC}"
fi

# Step 4: Test server (optional)
echo -e "\n${YELLOW}Do you want to test the server locally before deployment? (y/n)${NC}"
read -r test_server

if [[ $test_server == "y" ]]; then
  echo -e "${YELLOW}Starting test server...${NC}"
  node deploy-simple.js &
  server_pid=$!
  
  echo -e "${YELLOW}Server started with PID: $server_pid${NC}"
  echo -e "${YELLOW}Visit http://localhost:3000 to test${NC}"
  echo -e "${YELLOW}Press Enter to stop the test server and continue...${NC}"
  read -r
  
  kill $server_pid
  echo -e "${GREEN}✓${NC} Test server stopped"
fi

# Step 5: Final deployment instructions
echo -e "\n${GREEN}======================================${NC}"
echo -e "${GREEN}   Deployment Configuration Complete   ${NC}"
echo -e "${GREEN}======================================${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "1. Click the 'Deploy' button in Replit"
echo -e "2. Wait for the deployment to complete"
echo -e "3. Configure custom domain (www.thecurrentsee.org) in the Replit deployment settings"
echo -e "4. Update DNS settings on Namecheap"
echo -e "\n${YELLOW}For more information, see DEPLOYMENT.md${NC}"

echo -e "\n${GREEN}Deployment preparation completed successfully!${NC}"