import path from "path";
import { access } from "fs/promises";
import TranslationService from "../services/translationServices";

// Helper function to resolve paths correctly
const resolvePath = (envPath: string | undefined, fallbackPath: string): string => {
  if (envPath) {
    // If environment variable is provided, resolve it
    return path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath);
  }
  // Use fallback path relative to this script's location
  return path.resolve(__dirname, fallbackPath);
};

// Load paths from environment variables with fallback defaults
const webMessagesPath = resolvePath(
  process.env.WEB_MESSAGES_PATH,
  "../../../ITI-Graduation-Project-Recycling-System/messages"
);

const mobileMessagesPath = resolvePath(
  process.env.MOBILE_MESSAGES_PATH,
  "../../../Recycling-App/localization/languages"
);

// Array of all paths where translations should be updated
const translationPaths = [
  webMessagesPath,
  mobileMessagesPath
];

console.log("🔧 Resolved web messages path:", webMessagesPath);
console.log("🔧 Resolved mobile messages path:", mobileMessagesPath);

// Helper function to check if path exists and provide helpful feedback
const validatePath = async (pathToCheck: string, pathName: string): Promise<boolean> => {
  try {
    await access(pathToCheck);
    console.log(`✅ ${pathName} path is accessible`);
    return true;
  } catch (error) {
    console.error(`❌ ${pathName} path is not accessible:`, pathToCheck);
    console.error(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
};

// Validate paths before creating service
const validateAllPaths = async (): Promise<boolean> => {
  console.log("🔍 Validating translation paths...");
  
  const webPathValid = await validatePath(webMessagesPath, "Web messages");
  const mobilePathValid = await validatePath(mobileMessagesPath, "Mobile messages");
  
  const allValid = webPathValid && mobilePathValid;
  
  if (!allValid) {
    console.log("\n💡 Path resolution tips:");
    console.log("   1. Check your .env file paths");
    console.log("   2. Use absolute paths if relative paths don't work");
    console.log("   3. Ensure the target directories exist");
    console.log(`   4. Current working directory: ${process.cwd()}`);
    console.log(`   5. Script location: ${__dirname}`);
  }
  
  return allValid;
};

// Create translation service with multiple paths
const translationService = new TranslationService(translationPaths);

// Validate paths and provide feedback
validateAllPaths().then(isValid => {
  if (isValid) {
    console.log("✅ All translation paths validated successfully");
  } else {
    console.warn("⚠️ Some translation paths may not be accessible");
    console.log("🔧 Translation service created but some paths may cause issues");
  }
});

export default translationService;