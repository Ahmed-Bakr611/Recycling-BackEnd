// Test script specifically for debugging "كتب" translation issue
const axios = require("axios");

const BASE_URL = "http://localhost:3000";

async function testKutubTranslation() {
  console.log('=== Testing "كتب" Translation Issue ===\n');

  try {
    // 1. Check all translations in database
    console.log("1. Checking all translations...");
    const checkResponse = await axios.get(`${BASE_URL}/translations/check`);
    console.log("Total translations in DB:", checkResponse.data.total);

    // Look for translations containing "كتب"
    const kutubTranslations = checkResponse.data.translations.filter(
      (t) => (t.ar && t.ar.includes("كتب")) || (t.key && t.key.includes("كتب"))
    );
    console.log('Translations containing "كتب":', kutubTranslations);
    console.log("");

    // 2. Test debug endpoint with "كتب"
    console.log('2. Testing debug endpoint with "كتب"...');
    const debugResponse = await axios.get(
      `${BASE_URL}/cart/debug-translations?lang=en&item=كتب&category=paper`
    );
    console.log("Debug response:", JSON.stringify(debugResponse.data, null, 2));
    console.log("");

    // 3. Test debug endpoint with "books"
    console.log('3. Testing debug endpoint with "books"...');
    const debugBooksResponse = await axios.get(
      `${BASE_URL}/cart/debug-translations?lang=ar&item=books&category=paper`
    );
    console.log(
      "Debug books response:",
      JSON.stringify(debugBooksResponse.data, null, 2)
    );
    console.log("");

    // 4. Check if there's a translation for "books" -> "كتب"
    console.log('4. Looking for "books" translation...');
    const booksTranslations = checkResponse.data.translations.filter(
      (t) =>
        (t.key && t.key.includes("books")) || (t.en && t.en.includes("books"))
    );
    console.log('Translations containing "books":', booksTranslations);
    console.log("");

    // 5. Check all item translations
    console.log("5. All item translations:");
    const itemTranslations = checkResponse.data.translations.filter(
      (t) => t.key && t.key.startsWith("item_")
    );
    console.log("Item translations count:", itemTranslations.length);
    console.log("Sample item translations:", itemTranslations.slice(0, 5));
  } catch (error) {
    console.error("Test failed:", error.message);
  }
}

testKutubTranslation();
