import path from "path";
import TranslationService from "../services/translationServices";

// Replace "your-frontend-repo-name" with the actual folder name
const messagesPath = path.join(__dirname, "../../../ITI-Graduation-Project-Recycling-System/messages");
console.log("🔧 Resolved messages path:", messagesPath);
const translationService = new TranslationService(messagesPath);

export default translationService;