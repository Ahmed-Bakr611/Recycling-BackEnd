import path from "path";
import TranslationService from "./services/translationServices";

const messagesPath = path.join(
  __dirname,
  "../../ITI-Graduation-Project-Recycling-System/messages"
);

console.log("Resolved messages path:", messagesPath);

const translationService = new TranslationService(messagesPath);

(async () => {
  const enData = await translationService.readTranslationFile("en");
  const arData = await translationService.readTranslationFile("ar");

  console.log("📄 EN translations:", enData);
  console.log("📄 AR translations:", arData);
})();
