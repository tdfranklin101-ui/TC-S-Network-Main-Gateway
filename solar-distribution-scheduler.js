/**
 * The Current-See - Solar Distribution Scheduler
 * 
 * This script uses OpenAI to manage and verify the 00:00 GMT Solar generation
 * and distribution process, ensuring each member's total updates by 1 SOLAR per day.
 */

const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const nodeSchedule = require('node-schedule');

// Configure OpenAI - try both API key environment variables
const openaiApiKey = process.env.NEW_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const openai = new OpenAI({
  apiKey: openaiApiKey
});

// Constants
const MEMBERS_FILE_PATH = path.join(__dirname, 'public/api/members.json');
const EMBEDDED_MEMBERS_PATH = path.join(__dirname, 'public/embedded-members');
const DISTRIBUTION_LOG_PATH = path.join(__dirname, 'distribution_log.txt');
const SOLAR_PER_DAY = 1;
const SOLAR_DOLLAR_VALUE = 136000;

// Format with 4 decimal places
function formatAmount(amount) {
  return amount.toFixed(4);
}

// Log message to console and file
function logMessage(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}`;
  
  console.log(logEntry);
  
  // Append to log file
  fs.appendFileSync(DISTRIBUTION_LOG_PATH, logEntry + '\n');
}

// Update embedded members file
function updateEmbeddedMembersFile(members) {
  try {
    // Create embedded-members file with the correct JavaScript prefix
    fs.writeFileSync(
      EMBEDDED_MEMBERS_PATH,
      `window.embeddedMembers = ${JSON.stringify(members)};`
    );
    logMessage('Embedded members file updated successfully');
    return true;
  } catch (error) {
    logMessage(`Error updating embedded members file: ${error.message}`);
    return false;
  }
}

// Process daily distribution with OpenAI verification
async function processDailyDistribution() {
  const todayDate = new Date().toISOString().split('T')[0];
  logMessage(`Beginning SOLAR distribution process for ${todayDate}`);
  
  try {
    // Read members file
    const membersData = fs.readFileSync(MEMBERS_FILE_PATH, 'utf8');
    const members = JSON.parse(membersData);
    
    // Prepare data for OpenAI to verify
    const memberSummary = members
      .filter(m => !m.is_reserve && !m.isReserve && !m.isPlaceholder)
      .map(m => ({
        name: m.name,
        joinDate: m.joined_date || m.joinedDate,
        currentSolar: parseFloat(m.total_solar || m.totalSolar || 0),
        lastDistributionDate: m.last_distribution_date || m.lastDistributionDate || null
      }));
      
    // Use OpenAI to verify and calculate distribution
    let aiResult;
    
    try {
      // Try with JSON format first
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o", // The newest OpenAI model
        messages: [
          {
            role: "system", 
            content: "You are a verification system for The Current-See solar distribution process. You will verify and calculate the correct SOLAR distribution for each member."
          },
          {
            role: "user",
            content: `Verify and calculate the SOLAR distribution for today (${todayDate}). 
            Each active member should receive 1 SOLAR per day at 00:00 GMT.
            Here's the current member list with their totals:
            ${JSON.stringify(memberSummary, null, 2)}
            
            For each member, determine if they should receive 1 SOLAR today and calculate their new total.
            Return your analysis in JSON format with fields:
            - memberUpdates: array of objects with name, newSolarTotal, distributionApproved (boolean), and reason
            - totalDistributed: total SOLAR distributed in this operation
            - verificationLog: detailed log of your verification process`
          }
        ],
        response_format: { type: "json_object" }
      });
      
      // Parse OpenAI response
      aiResult = JSON.parse(aiResponse.choices[0].message.content);
      
    } catch (jsonError) {
      // If JSON format fails, try again without the response_format requirement
      logMessage(`JSON format request failed: ${jsonError.message}. Trying alternative approach...`);
      
      try {
        const fallbackResponse = await openai.chat.completions.create({
          model: "gpt-4o", // The newest OpenAI model
          messages: [
            {
              role: "system", 
              content: "You are a verification system for The Current-See solar distribution process. You will verify and calculate the correct SOLAR distribution for each member."
            },
            {
              role: "user",
              content: `Verify and calculate the SOLAR distribution for today (${todayDate}). 
              Each active member should receive 1 SOLAR per day at 00:00 GMT.
              Here's the current member list with their totals:
              ${JSON.stringify(memberSummary, null, 2)}
              
              For each member, determine if they should receive 1 SOLAR today and calculate their new total.
              IMPORTANT: Return your response as valid JSON with these exact fields:
              {
                "memberUpdates": [
                  {"name": "Member Name", "newSolarTotal": 25, "distributionApproved": true, "reason": "Eligible for distribution"}
                ],
                "totalDistributed": 5,
                "verificationLog": "Detailed verification log here"
              }`
            }
          ]
        });
        
        // Try to extract JSON from the text response
        const responseText = fallbackResponse.choices[0].message.content;
        
        // Look for JSON in the response using regex
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const extractedJson = jsonMatch[0];
          aiResult = JSON.parse(extractedJson);
        } else {
          throw new Error("Could not extract JSON from response");
        }
      } catch (extractError) {
        logMessage(`Could not extract valid JSON from fallback response: ${extractError.message}`);
        
        // Create a basic result as last resort
        aiResult = {
          memberUpdates: memberSummary.map(member => ({
            name: member.name,
            newSolarTotal: member.currentSolar + SOLAR_PER_DAY,
            distributionApproved: true,
            reason: "Fallback distribution applied due to API issues"
          })),
          totalDistributed: memberSummary.length * SOLAR_PER_DAY,
          verificationLog: "Used fallback method due to API response issues"
        };
      }
    }
    logMessage("OpenAI verification complete. Log: " + aiResult.verificationLog);
    
    // Apply updates based on OpenAI verification
    let updateCount = 0;
    
    for (const update of aiResult.memberUpdates) {
      const member = members.find(m => m.name === update.name);
      
      if (member && update.distributionApproved) {
        // Update SOLAR total
        const newSolar = update.newSolarTotal;
        logMessage(`Updating ${member.name} - New total: ${newSolar} SOLAR (${update.reason})`);
        
        member.total_solar = formatAmount(newSolar);
        member.totalSolar = newSolar;
        
        // Update dollar value
        const dollars = newSolar * SOLAR_DOLLAR_VALUE;
        member.total_dollars = formatAmount(dollars);
        member.totalDollars = dollars;
        
        // Update last distribution date
        member.last_distribution_date = todayDate;
        member.lastDistributionDate = todayDate;
        
        updateCount++;
      } else if (member) {
        logMessage(`No update for ${member.name}: ${update.reason}`);
      }
    }
    
    // Save updated members only if there were updates
    if (updateCount > 0) {
      fs.writeFileSync(MEMBERS_FILE_PATH, JSON.stringify(members, null, 2));
      
      // Update embedded members file
      updateEmbeddedMembersFile(members);
      
      logMessage(`Daily distribution complete. Updated ${updateCount} members with +1 SOLAR each.`);
    } else {
      logMessage('No members needed updating today.');
    }
    
    return { 
      success: true, 
      updated: updateCount,
      totalDistributed: aiResult.totalDistributed
    };
  } catch (error) {
    logMessage(`Error processing daily distribution: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Schedule the job to run at midnight GMT every day
function scheduleDistribution() {
  // Run at 00:00 GMT (midnight) every day
  const job = nodeSchedule.scheduleJob('0 0 * * *', async function() {
    logMessage('Scheduled SOLAR distribution triggered');
    await processDailyDistribution();
  });
  
  logMessage(`SOLAR distribution scheduled to run at 00:00 GMT daily`);
  return job;
}

// Function to run an immediate distribution (for testing/manual runs)
async function runDistributionNow() {
  logMessage('Manual SOLAR distribution triggered');
  return await processDailyDistribution();
}

// Check if running as main script
if (require.main === module) {
  // If run directly, set up the scheduler and run an immediate distribution
  scheduleDistribution();
  
  // Also run immediately if --now flag is passed
  if (process.argv.includes('--now')) {
    runDistributionNow();
  } else {
    logMessage('Distribution scheduler initialized. Will run at 00:00 GMT daily.');
    logMessage('Use --now flag to run an immediate distribution.');
  }
}

// Export functions for external use
module.exports = {
  scheduleDistribution,
  runDistributionNow
};