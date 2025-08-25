// services/translationService.ts - Updated for multi-path bilingual support
import fs from 'fs/promises';
import path from 'path';

interface TranslationFiles {
  en: string;
  ar: string;
}

export interface BilingualNames {
  en: string;
  ar: string;
}

export interface BilingualDescriptions {
  en?: string;
  ar?: string;
}

class TranslationService {
  private translationPaths: TranslationFiles[];
  private async processAllRepositories(
  processor: (enData: any, arData: any, pathIndex: number) => Promise<{ enData: any, arData: any }>
): Promise<void> {
  for (let pathIndex = 0; pathIndex < this.translationPaths.length; pathIndex++) {
    const [enData, arData] = await Promise.all([
      this.readTranslationFile('en', pathIndex),
      this.readTranslationFile('ar', pathIndex)
    ]);

    const processed = await processor(enData, arData, pathIndex);

    await Promise.all([
      this.writeTranslationFile('en', processed.enData, pathIndex),
      this.writeTranslationFile('ar', processed.arData, pathIndex)
    ]);
  }
}

  constructor(frontendPaths: string[]) {
    this.translationPaths = frontendPaths.map(frontendPath => ({
      en: path.join(frontendPath, "en.json"),
      ar: path.join(frontendPath, "ar.json"),
    }));
  }
async getCategoryTranslation(categoryKey: string): Promise<{
  name: BilingualNames;
  description: BilingualDescriptions;
} | null> {
  try {
    const [enData, arData] = await Promise.all([
      this.readTranslationFile('en', 0),
      this.readTranslationFile('ar', 0)
    ]);

    const enCategory = enData.categories?.[categoryKey.toLowerCase()];
    const arCategory = arData.categories?.[categoryKey.toLowerCase()];

    if (!enCategory && !arCategory) return null;

    return {
      name: {
        en: enCategory?.name || arCategory?.name || categoryKey,
        ar: arCategory?.name || enCategory?.name || categoryKey
      },
      description: {
        en: enCategory?.description,
        ar: arCategory?.description
      }
    };
  } catch (error) {
    console.error('❌ Error getting category translation:', error);
    return null;
  }
}
// Add this method to your TranslationService class

async updateCategoryTranslation(
  categoryKey: string,
  newNames: BilingualNames,
  newDescriptions?: BilingualDescriptions
): Promise<void> {
  return this.processAllRepositories(async (enData, arData) => {
    // Ensure categories object exists
    if (!enData.categories) enData.categories = {};
    if (!arData.categories) arData.categories = {};

    // Update existing category with same key
    const lowerCategoryKey = categoryKey.toLowerCase();
    
    enData.categories[lowerCategoryKey] = {
      name: newNames.en,
      description: newDescriptions?.en || enData.categories[lowerCategoryKey]?.description || `${newNames.en} category`
    };

    arData.categories[lowerCategoryKey] = {
      name: newNames.ar,
      description: newDescriptions?.ar || arData.categories[lowerCategoryKey]?.description || `فئة ${newNames.ar}`
    };

    return { enData, arData };
  });
}

// Alternative method if you need to change the category key itself
async renameCategoryKey(
  oldCategoryKey: string,
  newCategoryKey: string,
  newNames: BilingualNames,
  newDescriptions?: BilingualDescriptions
): Promise<void> {
  return this.processAllRepositories(async (enData, arData) => {
    const oldKey = oldCategoryKey.toLowerCase();
    const newKey = newCategoryKey.toLowerCase();

    // Ensure objects exist
    if (!enData.categories) enData.categories = {};
    if (!arData.categories) arData.categories = {};
    if (!enData.items) enData.items = {};
    if (!arData.items) arData.items = {};

    // Remove old category
    delete enData.categories[oldKey];
    delete arData.categories[oldKey];

    // Add new category
    enData.categories[newKey] = {
      name: newNames.en,
      description: newDescriptions?.en || `${newNames.en} category`
    };

    arData.categories[newKey] = {
      name: newNames.ar,
      description: newDescriptions?.ar || `فئة ${newNames.ar}`
    };

    // Move items from old category to new category
    if (enData.items[oldKey]) {
      enData.items[newKey] = enData.items[oldKey];
      delete enData.items[oldKey];
    }

    if (arData.items[oldKey]) {
      arData.items[newKey] = arData.items[oldKey];
      delete arData.items[oldKey];
    }

    return { enData, arData };
  });
}
  async readTranslationFile(locale: 'en' | 'ar', pathIndex: number = 0): Promise<any> {
    try {
      const content = await fs.readFile(this.translationPaths[pathIndex][locale], 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error reading ${locale}.json from path ${pathIndex}:`, error);
      return { categories: {}, items: {} };
    }
  }

  async writeTranslationFile(locale: 'en' | 'ar', data: any, pathIndex: number): Promise<void> {
    try {
      const dir = path.dirname(this.translationPaths[pathIndex][locale]);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(
        this.translationPaths[pathIndex][locale], 
        JSON.stringify(data, null, 2),
        'utf-8'
      );
      console.log(`✅ Updated ${locale}.json successfully at path ${pathIndex}`);
    } catch (error) {
      console.error(`❌ Error writing ${locale}.json at path ${pathIndex}:`, error);
      throw error;
    }
  }

  async writeTranslationFileToAllPaths(locale: 'en' | 'ar', data: any): Promise<void> {
    const writePromises = this.translationPaths.map((_, index) => 
      this.writeTranslationFile(locale, data, index)
    );
    await Promise.all(writePromises);
  }

  // Updated method to write to all paths simultaneously
// Updated addCategoryTranslation method
async addCategoryTranslation(
  categoryKey: string, 
  names: BilingualNames, 
  descriptions?: BilingualDescriptions
): Promise<void> {
  return this.processAllRepositories(async (enData, arData) => {
    if (!enData.categories) enData.categories = {};
    if (!arData.categories) arData.categories = {};

    enData.categories[categoryKey.toLowerCase()] = {
      name: names.en,
      description: descriptions?.en || `${names.en} category`
    };

    arData.categories[categoryKey.toLowerCase()] = {
      name: names.ar,
      description: descriptions?.ar || `فئة ${names.ar}`
    };

    return { enData, arData };
  });
}

async getItemTranslation(categoryKey: string, itemKey: string): Promise<BilingualNames | null> {
  try {
    const [enData, arData] = await Promise.all([
      this.readTranslationFile('en', 0),
      this.readTranslationFile('ar', 0)
    ]);

    const enName = enData.items?.[categoryKey.toLowerCase()]?.[itemKey.toLowerCase()];
    const arName = arData.items?.[categoryKey.toLowerCase()]?.[itemKey.toLowerCase()];

    if (!enName && !arName) return null;

    return {
      en: enName || arName || itemKey, // Fallback to the other language or original key
      ar: arName || enName || itemKey
    };
  } catch (error) {
    console.error('❌ Error getting item translation:', error);
    return null;
  }
}
async updateItemTranslationPartial(
  categoryKey: string,
  itemKey: string,
  updates: Partial<BilingualNames>
): Promise<void> {
  try {
    const [enData, arData] = await Promise.all([
      this.readTranslationFile('en', 0),
      this.readTranslationFile('ar', 0)
    ]);

    // Ensure the nested structure exists
    if (!enData.items) enData.items = {};
    if (!enData.items[categoryKey.toLowerCase()]) enData.items[categoryKey.toLowerCase()] = {};
    if (!arData.items) arData.items = {};
    if (!arData.items[categoryKey.toLowerCase()]) arData.items[categoryKey.toLowerCase()] = {};

    // Apply partial updates
    if (updates.en !== undefined) {
      enData.items[categoryKey.toLowerCase()][itemKey.toLowerCase()] = updates.en;
    }
    if (updates.ar !== undefined) {
      arData.items[categoryKey.toLowerCase()][itemKey.toLowerCase()] = updates.ar;
    }

    // Write to all paths
    await Promise.all([
      this.writeTranslationFileToAllPaths('en', enData),
      this.writeTranslationFileToAllPaths('ar', arData)
    ]);

    console.log(`✅ Updated item translation partially in all paths: ${updates.en || 'no en update'} / ${updates.ar || 'no ar update'}`);
  } catch (error) {
    console.error('❌ Error updating item translation partially:', error);
    throw error;
  }
}
  // Updated method to write to all paths simultaneously
async addItemTranslation(
  categoryKey: string, 
  itemKey: string, 
  names: BilingualNames
): Promise<void> {
  return this.processAllRepositories(async (enData, arData) => {
    if (!enData.items) enData.items = {};
    if (!enData.items[categoryKey.toLowerCase()]) enData.items[categoryKey.toLowerCase()] = {};
    
    if (!arData.items) arData.items = {};
    if (!arData.items[categoryKey.toLowerCase()]) arData.items[categoryKey.toLowerCase()] = {};

    enData.items[categoryKey.toLowerCase()][itemKey.toLowerCase()] = names.en;
    arData.items[categoryKey.toLowerCase()][itemKey.toLowerCase()] = names.ar;

    return { enData, arData };
  });
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
  return this.processAllRepositories(async (enData, arData) => {
    if (enData.items?.[categoryKey.toLowerCase()]?.[oldItemKey.toLowerCase()]) {
      delete enData.items[categoryKey.toLowerCase()][oldItemKey.toLowerCase()];
    }
    if (arData.items?.[categoryKey.toLowerCase()]?.[oldItemKey.toLowerCase()]) {
      delete arData.items[categoryKey.toLowerCase()][oldItemKey.toLowerCase()];
    }

    if (!enData.items) enData.items = {};
    if (!enData.items[categoryKey.toLowerCase()]) enData.items[categoryKey.toLowerCase()] = {};
    if (!arData.items) arData.items = {};
    if (!arData.items[categoryKey.toLowerCase()]) arData.items[categoryKey.toLowerCase()] = {};

    enData.items[categoryKey.toLowerCase()][newItemKey.toLowerCase()] = newNames.en;
    arData.items[categoryKey.toLowerCase()][newItemKey.toLowerCase()] = newNames.ar;

    return { enData, arData };
  });
}
async removeCategoryTranslation(categoryKey: string): Promise<void> {
  return this.processAllRepositories(async (enData, arData) => {
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

    return { enData, arData };
  });
}

async removeItemTranslation(categoryKey: string, itemKey: string): Promise<void> {
  return this.processAllRepositories(async (enData, arData) => {
    if (enData.items?.[categoryKey.toLowerCase()]?.[itemKey.toLowerCase()]) {
      delete enData.items[categoryKey.toLowerCase()][itemKey.toLowerCase()];
    }
    if (arData.items?.[categoryKey.toLowerCase()]?.[itemKey.toLowerCase()]) {
      delete arData.items[categoryKey.toLowerCase()][itemKey.toLowerCase()];
    }

    return { enData, arData };
  });
}

  // Utility method to get all configured paths
  getAllPaths(): string[] {
    return this.translationPaths.map(pathObj => path.dirname(pathObj.en));
  }

  // Method to check if all paths are accessible
  async validateAllPaths(): Promise<boolean> {
    try {
      const validationPromises = this.translationPaths.flatMap(pathObj => [
        fs.access(path.dirname(pathObj.en), fs.constants.F_OK),
        fs.access(path.dirname(pathObj.ar), fs.constants.F_OK)
      ]);
      
      await Promise.all(validationPromises);
      console.log('✅ All translation paths are accessible');
      return true;
    } catch (error) {
      console.error('❌ Some translation paths are not accessible:', error);
      return false;
    }
  }
}

export default TranslationService;