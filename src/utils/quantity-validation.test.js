// Test cases for quantity validation
// This demonstrates the validation logic for 0.25 KG increments

const testCases = [
  // Valid KG items (measurement_unit = 1)
  { quantity: 0.25, measurement_unit: 1, expected: true, description: "0.25 KG - Valid" },
  { quantity: 0.5, measurement_unit: 1, expected: true, description: "0.5 KG - Valid" },
  { quantity: 0.75, measurement_unit: 1, expected: true, description: "0.75 KG - Valid" },
  { quantity: 1.0, measurement_unit: 1, expected: true, description: "1.0 KG - Valid" },
  { quantity: 1.25, measurement_unit: 1, expected: true, description: "1.25 KG - Valid" },
  { quantity: 2.5, measurement_unit: 1, expected: true, description: "2.5 KG - Valid" },
  
  // Invalid KG items (measurement_unit = 1)
  { quantity: 0.1, measurement_unit: 1, expected: false, description: "0.1 KG - Invalid (not 0.25 increment)" },
  { quantity: 0.3, measurement_unit: 1, expected: false, description: "0.3 KG - Invalid (not 0.25 increment)" },
  { quantity: 0.6, measurement_unit: 1, expected: false, description: "0.6 KG - Invalid (not 0.25 increment)" },
  { quantity: 1.1, measurement_unit: 1, expected: false, description: "1.1 KG - Invalid (not 0.25 increment)" },
  { quantity: 0, measurement_unit: 1, expected: false, description: "0 KG - Invalid (below minimum)" },
  
  // Valid Piece items (measurement_unit = 2)
  { quantity: 1, measurement_unit: 2, expected: true, description: "1 Piece - Valid" },
  { quantity: 2, measurement_unit: 2, expected: true, description: "2 Pieces - Valid" },
  { quantity: 10, measurement_unit: 2, expected: true, description: "10 Pieces - Valid" },
  
  // Invalid Piece items (measurement_unit = 2)
  { quantity: 0.5, measurement_unit: 2, expected: false, description: "0.5 Pieces - Invalid (not whole number)" },
  { quantity: 1.5, measurement_unit: 2, expected: false, description: "1.5 Pieces - Invalid (not whole number)" },
  { quantity: 0, measurement_unit: 2, expected: false, description: "0 Pieces - Invalid (below minimum)" },
];

// Validation function (same as in controller)
const validateQuantity = (quantity, measurement_unit) => {
  if (measurement_unit === 1) { // KG items
    // Allow 0.25 increments: 0.25, 0.5, 0.75, 1.0, 1.25, etc.
    const multiplied = Math.round(quantity * 4);
    return multiplied >= 1 && Math.abs(quantity * 4 - multiplied) < 0.0001;
  } else { // Piece items
    // Require whole numbers >= 1
    return Number.isInteger(quantity) && quantity >= 1;
  }
};

// Run tests
console.log("🧪 Testing Quantity Validation for 0.25 KG Increments\n");
console.log("=" .repeat(60));

let passedTests = 0;
let totalTests = testCases.length;

testCases.forEach((test, index) => {
  const result = validateQuantity(test.quantity, test.measurement_unit);
  const status = result === test.expected ? "✅ PASS" : "❌ FAIL";
  
  if (result === test.expected) {
    passedTests++;
  }
  
  console.log(`${index + 1}. ${status} - ${test.description}`);
  if (result !== test.expected) {
    console.log(`   Expected: ${test.expected}, Got: ${result}`);
  }
});

console.log("\n" + "=" .repeat(60));
console.log(`📊 Results: ${passedTests}/${totalTests} tests passed`);

if (passedTests === totalTests) {
  console.log("🎉 All tests passed! The validation logic is working correctly.");
} else {
  console.log("⚠️  Some tests failed. Please review the validation logic.");
}

// Example API payloads that should now work
console.log("\n📤 Example API Payloads that should now work:");
console.log(JSON.stringify({ categoryId: "12345", quantity: 0.25, measurement_unit: 1, itemName: "Paper" }, null, 2));
console.log(JSON.stringify({ categoryId: "12345", quantity: 0.75, measurement_unit: 1, itemName: "Plastic" }, null, 2));
console.log(JSON.stringify({ categoryId: "12345", quantity: 2, measurement_unit: 2, itemName: "Bottles" }, null, 2));
