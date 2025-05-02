/**
 * The Current-See - Test Solar Distribution
 * 
 * This script tests the OpenAI-powered SOLAR distribution without waiting for
 * the scheduled 00:00 GMT execution time.
 */

const { runDistributionNow } = require('./solar-distribution-scheduler');

console.log('Starting SOLAR distribution test...');
console.log('This will use OpenAI to verify and process distributions.');
console.log('------------------------------------------------------');

// Run an immediate distribution test
runDistributionNow()
  .then(result => {
    console.log('------------------------------------------------------');
    console.log('SOLAR Distribution Test Result:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log(`SUCCESS: Updated ${result.updated} members with +1 SOLAR each.`);
      console.log(`Total SOLAR distributed: ${result.totalDistributed}`);
    } else {
      console.log(`ERROR: Distribution failed: ${result.error}`);
    }
  })
  .catch(error => {
    console.error('ERROR: Test failed with exception:', error);
  });