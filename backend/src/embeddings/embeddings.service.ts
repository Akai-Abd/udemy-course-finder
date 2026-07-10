import { Injectable, OnModuleInit, Logger } from '@nestjs/common';

@Injectable()
export class EmbeddingsService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingsService.name);
  private extractor: any;

  async onModuleInit() {
    this.logger.log('Initializing local HuggingFace embedding pipeline...');
    try {
      // Use dynamic import because @huggingface/transformers is an ESM package
      const { pipeline } = await (eval('import("@huggingface/transformers")') as Promise<typeof import('@huggingface/transformers')>);
      
      // Load the feature extraction pipeline with Xenova/all-MiniLM-L6-v2
      this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      this.logger.log('✅ Embedding pipeline initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize embedding pipeline:', error);
    }
  }

  async generate(text: string): Promise<number[]> {
    if (!this.extractor) {
      this.logger.warn('Embedding extractor is not initialized yet. Re-trying initialization...');
      await this.onModuleInit();
      if (!this.extractor) {
        throw new Error('Embedding pipeline could not be initialized.');
      }
    }

    const cleanText = text.replace(/\s+/g, ' ').trim();
    if (!cleanText) {
      return new Array(384).fill(0);
    }

    try {
      const output = await this.extractor(cleanText, {
        pooling: 'mean',
        normalize: true,
      });

      return Array.from(output.data);
    } catch (error) {
      this.logger.error(`Error generating embedding for text: "${text.substring(0, 50)}...":`, error);
      throw error;
    }
  }
}
