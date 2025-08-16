// scripts/build-translations.ts
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

interface TranslationBuildConfig {
  sources: Array<{
    name: string;
    path: string;
    pattern: string;
  }>;
  output: string;
  environments: string[];
}

class TranslationBuilder {
  private config: TranslationBuildConfig;

  constructor() {
    this.config = {
      sources: [
        {
          name: 'web',
          path: process.env.WEB_MESSAGES_PATH || '../ITI-Graduation-Project-Recycling-System/messages',
          pattern: '**/*.json'
        },
        {
          name: 'mobile', 
          path: process.env.MOBILE_MESSAGES_PATH || '../Recycling-App/localization/languages',
          pattern: '**/*.json'
        }
      ],
      output: './dist/translations',
      environments: ['staging', 'production']
    };
  }

  async buildForDeployment(): Promise<void> {
    const environment = process.env.NODE_ENV || 'development';
    
    if (!this.config.environments.includes(environment)) {
      console.log(`⏭️ Skipping translation build for ${environment} environment`);
      return;
    }

    console.log(`🏗️ Building translations for ${environment} deployment...`);

    // Create output directory
    await fs.mkdir(this.config.output, { recursive: true });

    // Process each translation source
    for (const source of this.config.sources) {
      await this.processSource(source);
    }

    console.log(`✅ Translation build completed for ${environment}`);
  }

  private async processSource(source: { name: string; path: string; pattern: string }): Promise<void> {
    try {
      const sourcePath = path.resolve(source.path);
      console.log(`📂 Processing ${source.name} translations from: ${sourcePath}`);

      // Find all translation files
      const files = await glob(source.pattern, { 
        cwd: sourcePath,
        absolute: true 
      });

      if (files.length === 0) {
        console.warn(`⚠️ No translation files found for ${source.name}`);
        return;
      }

      // Create source-specific output directory
      const sourceOutput = path.join(this.config.output, source.name);
      await fs.mkdir(sourceOutput, { recursive: true });

      // Copy and process each file
      for (const file of files) {
        const relativePath = path.relative(sourcePath, file);
        const outputFile = path.join(sourceOutput, relativePath);
        
        // Ensure output directory exists
        await fs.mkdir(path.dirname(outputFile), { recursive: true });
        
        // Read, validate, and copy translation file
        const content = await fs.readFile(file, 'utf-8');
        try {
          const parsed = JSON.parse(content);
          // Write formatted JSON to ensure consistency
          await fs.writeFile(outputFile, JSON.stringify(parsed, null, 2));
          console.log(`✅ Built: ${relativePath}`);
        } catch (error) {
          console.error(`❌ Invalid JSON in ${relativePath}:`, error);
          throw error;
        }
      }

    } catch (error) {
      console.error(`❌ Failed to process ${source.name} translations:`, error);
      throw error;
    }
  }

  // Create a manifest file for runtime
  async createManifest(): Promise<void> {
    const manifest = {
      buildTime: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      sources: this.config.sources.map(s => s.name),
      version: process.env.npm_package_version || '1.0.0'
    };

    const manifestPath = path.join(this.config.output, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`📋 Translation manifest created: ${manifestPath}`);
  }
}

// Build script execution
const builder = new TranslationBuilder();

async function main() {
  try {
    await builder.buildForDeployment();
    await builder.createManifest();
    console.log('🎉 Translation build process completed successfully!');
  } catch (error) {
    console.error('💥 Translation build failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { TranslationBuilder };