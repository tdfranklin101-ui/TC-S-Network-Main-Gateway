# Marketplace Search & Request System

## Overview

The TC-S Network Marketplace allows members to search for items and request products that aren't currently available. All item requests go through a **human review process** before any purchases or listings are created.

## How to Search

1. Visit the Marketplace page
2. Enter your search terms in the search box at the top
3. Click "Search" or press Enter
4. Browse the results

## Requesting Items Not Found

If your search returns no results, you can submit a request:

1. A "Request this item" panel will appear automatically
2. Your search query is pre-filled
3. Optionally specify:
   - **Budget** - Maximum amount you're willing to pay
   - **Condition** - New, Used, Refurbished, or Any
   - **Urgency** - Normal, Low, High, or Urgent
4. Click "Submit Request"

## What Happens After You Submit

**Important: Requests are NOT instantly filled.**

Here's the process:

1. **Request Created** - Your request enters the queue with status "NEW"
2. **AI Scout Reviews** - An automated agent searches approved vendor portals (Amazon, Walmart, eBay) and generates recommendations
3. **Human Review Required** - A Foundation administrator must review all recommendations before any action is taken
4. **Admin Decision** - The admin can:
   - **Approve** - Creates a draft marketplace listing
   - **Reject** - Declines the request with notes
   - **Request More Info** - Returns for clarification
5. **Publishing** - Approved items must be separately published before appearing in the marketplace

## Why Human Review?

The Foundation maintains a human-in-the-loop requirement to ensure:

- Quality control over marketplace offerings
- Verification of vendor legitimacy
- Accurate Solar token pricing based on energy costs
- Protection of member interests
- Compliance with Foundation standards

## Request Status Values

| Status | Meaning |
|--------|---------|
| NEW | Just submitted, awaiting scout |
| SCOUTING | AI agent is gathering recommendations |
| REVIEW_READY | Ready for admin review |
| APPROVED | Admin approved, draft listing created |
| REJECTED | Admin declined the request |
| PUBLISHED | Item is now live in marketplace |
| ERROR | Processing issue, requires manual attention |

## Allowed Vendor Portals

The AI Scout only searches pre-approved vendor portals:

- Amazon
- Walmart
- eBay

No purchases are made automatically. All vendor recommendations require Foundation approval.

## For Administrators

Admin review dashboard: `/admin/procurement-review.html`

Requires admin authentication. See the admin documentation for review procedures.
