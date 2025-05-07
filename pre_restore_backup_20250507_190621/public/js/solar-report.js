/**
 * Solar Report Generator
 * 
 * This module generates summary reports using the solar ledger data.
 * Based on the Python implementation provided by the client.
 */

// Function to generate and display a solar daily summary report
function generateSolarReport(elementId) {
  // Get the target element
  const targetElement = document.getElementById(elementId);
  if (!targetElement) {
    console.error(`Element with ID '${elementId}' not found.`);
    return;
  }

  // Get ledger data from SolarConstants if available
  if (!window.SolarConstants || !window.SolarConstants.getLedgerData) {
    targetElement.innerHTML = '<div class="error-message">Solar constants not available.</div>';
    return;
  }
  
  // Get the ledger data
  const ledger = window.SolarConstants.getLedgerData();
  
  // Format the report
  const reportHTML = `
    <div class="solar-report">
      <h3>Solar Daily Summary Report</h3>
      <div class="report-date">Date: ${ledger.date}</div>
      <table class="report-table">
        <tr>
          <td>Total MkWh Generated:</td>
          <td>${ledger.mkwh_generated.toFixed(6)} MkWh</td>
        </tr>
        <tr>
          <td>Solar per Person (kWh):</td>
          <td>${ledger.solar_per_person_kwh.toFixed(2)} kWh</td>
        </tr>
        <tr>
          <td>Value per Solar (USD):</td>
          <td>$${ledger.solar_value_usd.toLocaleString()}</td>
        </tr>
        <tr>
          <td>Total Solars Issued:</td>
          <td>${parseInt(ledger.total_solars_issued).toLocaleString()}</td>
        </tr>
        <tr>
          <td>Total Solars Distributed:</td>
          <td>${ledger.total_solars_distributed.toLocaleString()}</td>
        </tr>
        <tr>
          <td>Total Solars Reserved:</td>
          <td>${parseInt(ledger.total_solars_reserved).toLocaleString()}</td>
        </tr>
      </table>
      
      <h4>Wallet Registry</h4>
      <table class="registry-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Solars Received</th>
          </tr>
        </thead>
        <tbody>
          ${ledger.registrants.map(registrant => `
            <tr>
              <td>${registrant.name}</td>
              <td>${registrant.email}</td>
              <td>${registrant.solars_received} Solar(s)</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  
  // Add CSS for the report
  const reportStyle = `
    <style>
      .solar-report {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
        background-color: #f9f9f9;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .solar-report h3 {
        color: #2e7d32;
        margin-top: 0;
        text-align: center;
        border-bottom: 2px solid #2e7d32;
        padding-bottom: 10px;
      }
      .solar-report h4 {
        color: #2e7d32;
        margin-top: 20px;
        border-bottom: 1px solid #ddd;
        padding-bottom: 5px;
      }
      .report-date {
        text-align: right;
        font-style: italic;
        margin-bottom: 15px;
      }
      .report-table, .registry-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
      }
      .report-table td, .registry-table td, .registry-table th {
        padding: 8px;
        border-bottom: 1px solid #ddd;
      }
      .report-table tr:last-child td {
        border-bottom: none;
      }
      .report-table td:first-child {
        font-weight: bold;
        width: 60%;
      }
      .report-table td:last-child {
        text-align: right;
      }
      .registry-table th {
        background-color: #f5f5f5;
        text-align: left;
        font-weight: bold;
      }
      .registry-table tr:hover {
        background-color: #f1f1f1;
      }
      .error-message {
        color: red;
        text-align: center;
        padding: 20px;
      }
    </style>
  `;
  
  // Set the HTML
  targetElement.innerHTML = reportStyle + reportHTML;
}

// Add to window object for global access
window.SolarReport = {
  generate: generateSolarReport
};