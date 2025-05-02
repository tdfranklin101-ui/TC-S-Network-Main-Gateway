# The Current-See Deployment Checklist

## 1. Critical Fix for Member Display

✅ Issue Identified: The TC-S Solar Reserve account was being filtered out in some views and API responses.

✅ Fixed Files:
- `public/js/fixed-members-log.js` - Ensures TC-S Solar Reserve is always displayed
- `public/members-list.html` - Updated to use the fixed script

⚠️ Deployment Steps Needed:
- Copy `public/js/fixed-members-log.js` to the deployment server
- Update `public/members-list.html` in deployment to use fixed-members-log.js
- Verify that all API endpoints in deployment server are properly returning TC-S Solar Reserve

## 2. API Endpoint Verification

The deployment server `deploy-stable.js` already has proper API implementations:
- `/api/members.json` - Returns all members including TC-S Solar Reserve 
- `/api/members` - Returns all members including TC-S Solar Reserve
- `/embedded-members` - Returns all members including TC-S Solar Reserve

✅ These endpoints are properly implemented in `deploy-stable.js` - no changes needed.

## 3. Client-Side Upgrade

Our improved client-side script includes extra protection to ensure the TC-S Solar Reserve is displayed even if API endpoints fail to include it. This gives us a double layer of protection.

✅ The fixed script adds the TC-S Solar Reserve account if it's missing from API responses.

## 4. Final Testing

Before deploying to www.thecurrentsee.org, verify:
- TC-S Solar Reserve appears at the top of the members list
- All 17 members are displayed correctly
- The solar values and dollar calculations are correct
- Sorting shows Terry D. Franklin as the first regular member
- JF as the second regular member
- Other members are displayed in reverse chronological order (newest first)

## 5. Deployment Recommendation

Proceed with standard deployment, but make sure to include the updated client-side scripts in the deployment package:
- `public/js/fixed-members-log.js`
- Updated `public/members-list.html`

The deployment should include test files to verify functionality:
- `public/final-members-test.html`