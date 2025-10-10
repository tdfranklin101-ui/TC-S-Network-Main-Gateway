# Kid Solar Function Calling - Implementation Guide

## Overview
Kid Solar now supports OpenAI function calling to execute real marketplace wallet operations via voice or text commands.

## Implemented Functions

### 1. `purchase_artifact`
**Description**: Purchase music, videos, or items from the marketplace using Solar tokens.

**Parameters**:
- `title` (required): The title of the artifact to purchase
- `slug` (optional): The URL slug if known

**Example Voice Commands**:
- "Buy Rasta Lady Voodoo"
- "Purchase Snowmancer One"
- "I want to buy the Voodoo track"

**Response Flow**:
1. User says: "Buy Rasta Lady Voodoo"
2. GPT-4o identifies function: `purchase_artifact({title: "Rasta Lady Voodoo"})`
3. System checks user balance from `members` table
4. If sufficient balance:
   - Deducts Solar from user's `total_solar`
   - Creates transaction record in `transactions` table
   - Returns success with new balance
5. Kid Solar responds: "I've purchased Rasta Lady Voodoo for 0.001 Solar! Your new balance is X.XXX Solar"

**Database Operations**:
```sql
-- Check artifact exists and get price
SELECT * FROM artifacts WHERE LOWER(title) LIKE LOWER('%Rasta Lady Voodoo%') AND active = true LIMIT 1

-- Check user balance
SELECT total_solar, name FROM members WHERE id = $memberId

-- Deduct Solar
UPDATE members SET total_solar = $newBalance WHERE id = $memberId

-- Create transaction
INSERT INTO transactions (user_id, type, amount, currency, status, description, metadata, completed_at)
VALUES ($memberId, 'solar_spend', $price, 'SOLAR', 'completed', 'Purchased: Rasta Lady Voodoo', {...}, NOW())
```

---

### 2. `preview_artifact`
**Description**: Get streaming preview URL for music samples, videos, or content.

**Parameters**:
- `title` (required): The title of the artifact to preview

**Example Voice Commands**:
- "Play Snowmancer One"
- "Preview Rasta Lady Voodoo"
- "Let me hear a sample of the jazz track"

**Response Flow**:
1. User says: "Play Snowmancer One"
2. GPT-4o identifies function: `preview_artifact({title: "Snowmancer One"})`
3. System queries artifact for streaming URLs
4. Returns preview information with streaming URL
5. Kid Solar responds: "Here's a preview of Snowmancer One. You can stream it from the marketplace for 0.001 Solar."

**Database Operations**:
```sql
SELECT * FROM artifacts 
WHERE LOWER(title) LIKE LOWER('%Snowmancer One%') AND active = true LIMIT 1
```

---

### 3. `check_wallet_balance`
**Description**: Check the user's current Solar token balance.

**Parameters**: None

**Example Voice Commands**:
- "What's my balance?"
- "How much Solar do I have?"
- "Check my wallet"

**Response Flow**:
1. User says: "What's my balance?"
2. GPT-4o identifies function: `check_wallet_balance({})`
3. System queries member's balance
4. Returns balance information
5. Kid Solar responds: "You have 5.2500 Solar in your wallet. Keep earning!"

**Database Operations**:
```sql
SELECT total_solar, total_dollars, name, joined_date 
FROM members WHERE id = $memberId
```

---

### 4. `list_marketplace_items`
**Description**: List available items from marketplace, optionally filtered by category or price.

**Parameters**:
- `category` (optional): Filter by 'music', 'video', 'art', 'text', or 'all'
- `maxPrice` (optional): Maximum Solar price (e.g., 0.01)
- `limit` (optional): Max number of items (default 10)

**Example Voice Commands**:
- "Show me music under 0.01 Solar"
- "List all videos"
- "What art is available for less than 0.05 Solar?"

**Response Flow**:
1. User says: "Show me music under 0.01 Solar"
2. GPT-4o identifies function: `list_marketplace_items({category: "music", maxPrice: 0.01})`
3. System queries artifacts with filters
4. Returns list of matching items
5. Kid Solar responds: "I found 3 music tracks under 0.01 Solar: Rasta Lady Voodoo (0.001), Snowmancer One (0.008), and Jazz Nights (0.009)."

**Database Operations**:
```sql
SELECT * FROM artifacts 
WHERE active = true 
  AND category = $category 
  AND CAST(solar_amount_s AS DECIMAL) <= $maxPrice
ORDER BY CAST(solar_amount_s AS DECIMAL) ASC 
LIMIT $limit
```

---

## API Response Format

### Success Response with Function Call
```json
{
  "success": true,
  "response": "I've purchased Rasta Lady Voodoo for 0.001 Solar! Your new balance is 5.249 Solar",
  "transcript": "Buy Rasta Lady Voodoo",
  "audioUrl": "data:audio/mpeg;base64,...",
  "conversationId": "conv_1234567890",
  "intent": "purchase_artifact",
  "functionCalled": "purchase_artifact",
  "functionArgs": {
    "title": "Rasta Lady Voodoo"
  },
  "functionData": {
    "success": true,
    "artifact": {
      "id": "uuid-123",
      "title": "Rasta Lady Voodoo",
      "slug": "rasta-lady-voodoo",
      "price": 0.001,
      "downloadUrl": "/storage/trade/rasta-lady-voodoo.mp3",
      "streamingUrl": "/music/rasta-lady-voodoo"
    },
    "transaction": {
      "oldBalance": 5.250,
      "newBalance": 5.249,
      "amountSpent": 0.001
    }
  }
}
```

### Error Response (Insufficient Balance)
```json
{
  "success": true,
  "response": "You don't have enough Solar for that. Rasta Lady Voodoo costs 0.001 Solar, but you only have 0.0005 Solar.",
  "functionCalled": "purchase_artifact",
  "functionArgs": {
    "title": "Rasta Lady Voodoo"
  },
  "functionData": {
    "success": false,
    "error": "Insufficient balance. You have 0.0005 Solar, but this costs 0.001 Solar",
    "balance": 0.0005,
    "price": 0.001,
    "artifact": {
      "title": "Rasta Lady Voodoo",
      "price": 0.001
    }
  }
}
```

---

## Testing Examples

### Test 1: Purchase with Sufficient Balance
```bash
curl -X POST http://localhost:8080/api/kid-solar/voice \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Buy Rasta Lady Voodoo",
    "memberId": 1,
    "memberName": "John Doe",
    "conversationId": "test_123"
  }'
```

### Test 2: Check Balance
```bash
curl -X POST http://localhost:8080/api/kid-solar/voice \
  -H "Content-Type: application/json" \
  -d '{
    "text": "What is my balance?",
    "memberId": 1,
    "conversationId": "test_123"
  }'
```

### Test 3: List Items with Filters
```bash
curl -X POST http://localhost:8080/api/kid-solar/voice \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Show me all music under 0.01 Solar",
    "memberId": 1,
    "conversationId": "test_123"
  }'
```

### Test 4: Preview Content
```bash
curl -X POST http://localhost:8080/api/kid-solar/voice \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Play Snowmancer One",
    "memberId": 1,
    "conversationId": "test_123"
  }'
```

---

## Database Schema Requirements

### Members Table
```sql
CREATE TABLE members (
  id INTEGER PRIMARY KEY,
  username VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  email VARCHAR NOT NULL,
  total_solar TEXT DEFAULT '0',
  total_dollars TEXT DEFAULT '0',
  joined_date TIMESTAMP DEFAULT NOW()
);
```

### Artifacts Table
```sql
CREATE TABLE artifacts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  file_type TEXT NOT NULL,
  solar_amount_s VARCHAR NOT NULL,
  streaming_url TEXT,
  preview_file_url TEXT,
  trade_file_url TEXT,
  active BOOLEAN DEFAULT true
);
```

### Transactions Table
```sql
CREATE TABLE transactions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id),
  type VARCHAR NOT NULL,
  amount INTEGER NOT NULL,
  currency VARCHAR DEFAULT 'SOLAR',
  status VARCHAR NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

---

## Implementation Details

### Function Definitions (OpenAI Tools Format)
The functions are defined in `server/kid-solar-voice.js` as:

```javascript
this.functionDefinitions = [
  {
    type: "function",
    function: {
      name: "purchase_artifact",
      description: "Purchase a music track, video, or other item from the marketplace using Solar tokens. Checks balance and creates transaction.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "The title or name of the artifact to purchase (e.g., 'Rasta Lady Voodoo', 'Snowmancer One')"
          },
          slug: {
            type: "string",
            description: "Optional: The URL slug of the artifact if known"
          }
        },
        required: ["title"]
      }
    }
  },
  // ... other functions
];
```

### OpenAI Function Calling Flow
1. User input is sent to GPT-4o with available tools
2. GPT-4o decides whether to use a tool or respond directly
3. If tool is needed, GPT-4o returns `tool_calls` array
4. System executes the function via `executeFunctionCall()`
5. Function result is sent back to GPT-4o
6. GPT-4o generates final conversational response
7. Response is converted to speech via TTS

---

## Security & Authentication

- **Authentication**: All functions require valid `memberId` from session
- **Balance Validation**: Purchase checks balance before deducting
- **SQL Injection Protection**: All queries use parameterized statements
- **Error Handling**: Graceful degradation with user-friendly error messages
- **Transaction Atomicity**: Database updates use proper transaction handling

---

## Multimodal Support

Kid Solar supports multiple input modalities:

1. **Voice**: User speaks → Whisper transcribes → Function calling → TTS responds
2. **Text**: User types → Function calling → TTS responds
3. **Image + Voice/Text**: Image analysis + function calling capabilities
4. **File + Voice/Text**: Document analysis + function calling capabilities

All modalities support the same function calling capabilities for marketplace operations.
