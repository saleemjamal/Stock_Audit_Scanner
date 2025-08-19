const fs = require('fs');
const path = require('path');

// Read the CSV file
const csvPath = 'C:\\Projects\\Stock_Audit\\current_stock\\adyar_190825.csv';
const csvContent = fs.readFileSync(csvPath, 'utf8');

// Split into lines and skip header
const lines = csvContent.split('\n');
const dataLines = lines.slice(1).filter(line => line.trim());

let totalExpectedValue = 0;
let itemCount = 0;

console.log('Processing CSV file...');
console.log('First few rows:');

dataLines.forEach((line, index) => {
  if (line.trim()) {
    const columns = line.split(',');
    if (columns.length >= 5) {
      const expectedQuantity = parseFloat(columns[3]) || 0;
      const unitCost = parseFloat(columns[4]) || 0;
      const lineValue = expectedQuantity * unitCost;
      
      totalExpectedValue += lineValue;
      itemCount++;
      
      // Show first 10 rows for verification
      if (index < 10) {
        console.log(`${columns[0]}: ${expectedQuantity} × ${unitCost} = ₹${lineValue}`);
      }
    }
  }
});

console.log('\n=== RESULTS ===');
console.log(`Total items processed: ${itemCount}`);
console.log(`Total Expected Value: ₹${totalExpectedValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
console.log(`Average unit cost: ₹${(totalExpectedValue / itemCount).toFixed(2)}`);