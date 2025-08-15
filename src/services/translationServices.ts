// services/translationService.ts - Updated for bilingual support
import fs from 'fs/promises';
import path from 'path';

interface TranslationFiles {
  en: string;
  ar: string;
}

interface BilingualNames {
  en: string;
  ar: string;
}

interface BilingualDescriptions {
  en?: string;
  ar?: string;
}

class TranslationService {
  private translationPaths: TranslationFiles;

  constructor(frontendPath: string) {
    this.translationPaths = {
      en: path.join(frontendPath, "en.json"),
      ar: path.join(frontendPath, "ar.json"),
    };
  }

  async readTranslationFile(locale: 'en' | 'ar'): Promise<any> {
    try {
      const content = await fs.readFile(this.translationPaths[locale], 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error reading ${locale}.json:`, error);
      return { categories: {}, items: {} };
    }
  }

  async writeTranslationFile(locale: 'en' | 'ar', data: any): Promise<void> {
    try {
      const dir = path.dirname(this.translationPaths[locale]);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(
        this.translationPaths[locale], 
        JSON.stringify(data, null, 2),
        'utf-8'
      );
      console.log(`✅ Updated ${locale}.json successfully`);
    } catch (error) {
      console.error(`❌ Error writing ${locale}.json:`, error);
      throw error;
    }
  }

  // Updated method to accept bilingual names and descriptions
  async addCategoryTranslation(
    categoryKey: string, 
    names: BilingualNames, 
    descriptions?: BilingualDescriptions
  ): Promise<void> {
    try {
      const [enData, arData] = await Promise.all([
        this.readTranslationFile('en'),
        this.readTranslationFile('ar')
      ]);

      if (!enData.categories) enData.categories = {};
      if (!arData.categories) arData.categories = {};

      // Add English translation
      enData.categories[categoryKey.toLowerCase()] = {
        name: names.en,
        description: descriptions?.en || `${names.en} category`
      };

      // Add Arabic translation
      arData.categories[categoryKey.toLowerCase()] = {
        name: names.ar,
        description: descriptions?.ar || `فئة ${names.ar}`
      };

      await Promise.all([
        this.writeTranslationFile('en', enData),
        this.writeTranslationFile('ar', arData)
      ]);

      console.log(`✅ Added bilingual category translation: ${names.en} / ${names.ar}`);
    } catch (error) {
      console.error('❌ Error adding bilingual category translation:', error);
      throw error;
    }
  }

  // Updated method to accept bilingual item names
  async addItemTranslation(
    categoryKey: string, 
    itemKey: string, 
    names: BilingualNames
  ): Promise<void> {
    try {
      const [enData, arData] = await Promise.all([
        this.readTranslationFile('en'),
        this.readTranslationFile('ar')
      ]);

      // Create nested structure
      if (!enData.items) enData.items = {};
      if (!enData.items[categoryKey.toLowerCase()]) enData.items[categoryKey.toLowerCase()] = {};
      
      if (!arData.items) arData.items = {};
      if (!arData.items[categoryKey.toLowerCase()]) arData.items[categoryKey.toLowerCase()] = {};

      // Add translations
      enData.items[categoryKey.toLowerCase()][itemKey.toLowerCase()] = names.en;
      arData.items[categoryKey.toLowerCase()][itemKey.toLowerCase()] = names.ar;

      await Promise.all([
        this.writeTranslationFile('en', enData),
        this.writeTranslationFile('ar', arData)
      ]);

      console.log(`✅ Added bilingual item translation: ${names.en} / ${names.ar}`);
    } catch (error) {
      console.error('❌ Error adding bilingual item translation:', error);
      throw error;
    }
  }

  // Backward compatibility - if only single name provided
  async addCategoryTranslationSingle(categoryName: string, description?: string): Promise<void> {
    const names: BilingualNames = {
      en: categoryName,
      ar: categoryName // You might want to translate this
    };
    
    const descriptions: BilingualDescriptions = {
      en: description,
      ar: description ? `وصف ${categoryName}` : `فئة ${categoryName}`
    };

    return this.addCategoryTranslation(categoryName, names, descriptions);
  }

  // Backward compatibility - if only single name provided
  async addItemTranslationSingle(categoryName: string, itemName: string): Promise<void> {
    const names: BilingualNames = {
      en: itemName,
      ar: itemName // You might want to translate this
    };

    return this.addItemTranslation(categoryName, itemName, names);
  }

  async updateItemTranslation(
    categoryKey: string, 
    oldItemKey: string, 
    newItemKey: string, 
    newNames: BilingualNames
  ): Promise<void> {
    try {
      const [enData, arData] = await Promise.all([
        this.readTranslationFile('en'),
        this.readTranslationFile('ar')
      ]);

      // Remove old translations
      if (enData.items?.[categoryKey.toLowerCase()]?.[oldItemKey.toLowerCase()]) {
        delete enData.items[categoryKey.toLowerCase()][oldItemKey.toLowerCase()];
      }
      if (arData.items?.[categoryKey.toLowerCase()]?.[oldItemKey.toLowerCase()]) {
        delete arData.items[categoryKey.toLowerCase()][oldItemKey.toLowerCase()];
      }

      // Add new translations
      if (!enData.items) enData.items = {};
      if (!enData.items[categoryKey.toLowerCase()]) enData.items[categoryKey.toLowerCase()] = {};
      if (!arData.items) arData.items = {};
      if (!arData.items[categoryKey.toLowerCase()]) arData.items[categoryKey.toLowerCase()] = {};

      enData.items[categoryKey.toLowerCase()][newItemKey.toLowerCase()] = newNames.en;
      arData.items[categoryKey.toLowerCase()][newItemKey.toLowerCase()] = newNames.ar;

      await Promise.all([
        this.writeTranslationFile('en', enData),
        this.writeTranslationFile('ar', arData)
      ]);

      console.log(`✅ Updated bilingual item translation: ${newNames.en} / ${newNames.ar}`);
    } catch (error) {
      console.error('❌ Error updating bilingual item translation:', error);
      throw error;
    }
  }

  async removeCategoryTranslation(categoryKey: string): Promise<void> {
    try {
      const [enData, arData] = await Promise.all([
        this.readTranslationFile('en'),
        this.readTranslationFile('ar')
      ]);

      if (enData.categories) {
        delete enData.categories[categoryKey.toLowerCase()];
      }
      if (arData.categories) {
        delete arData.categories[categoryKey.toLowerCase()];
      }

      if (enData.items) {
        delete enData.items[categoryKey.toLowerCase()];
      }
      if (arData.items) {
        delete arData.items[categoryKey.toLowerCase()];
      }

      await Promise.all([
        this.writeTranslationFile('en', enData),
        this.writeTranslationFile('ar', arData)
      ]);

      console.log(`✅ Removed category translation: ${categoryKey}`);
    } catch (error) {
      console.error('❌ Error removing category translation:', error);
      throw error;
    }
  }

  async removeItemTranslation(categoryKey: string, itemKey: string): Promise<void> {
    try {
      const [enData, arData] = await Promise.all([
        this.readTranslationFile('en'),
        this.readTranslationFile('ar')
      ]);

      if (enData.items?.[categoryKey.toLowerCase()]?.[itemKey.toLowerCase()]) {
        delete enData.items[categoryKey.toLowerCase()][itemKey.toLowerCase()];
      }
      if (arData.items?.[categoryKey.toLowerCase()]?.[itemKey.toLowerCase()]) {
        delete arData.items[categoryKey.toLowerCase()][itemKey.toLowerCase()];
      }

      await Promise.all([
        this.writeTranslationFile('en', enData),
        this.writeTranslationFile('ar', arData)
      ]);

      console.log(`✅ Removed item translation: ${itemKey}`);
    } catch (error) {
      console.error('❌ Error removing item translation:', error);
      throw error;
    }
  }
}

export default TranslationService;