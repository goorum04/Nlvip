import { StitchToolClient } from '@google/stitch-sdk';

/**
 * StitchClient - A wrapper around the Google Stitch SDK.
 * 
 * To activate, add STITCH_API_KEY to your .env.local file.
 * This client allows for programmatic UI generation and integration with
 * Stitch's design tools directly from the codebase.
 */
class StitchClient {
  constructor() {
    this.apiKey = process.env.STITCH_API_KEY || process.env.NEXT_PUBLIC_STITCH_API_KEY;
    this.client = null;
    
    if (this.apiKey) {
      try {
        this.client = new StitchToolClient({ apiKey: this.apiKey });
        console.log('✅ Google Stitch Client initialized');
      } catch (error) {
        console.error('❌ Failed to initialize Google Stitch Client:', error);
      }
    } else {
      console.warn('⚠️ STITCH_API_KEY not found. Stitch functionality will be in "Design Preview" mode.');
    }
  }

  /**
   * Generates a UI component structure based on a prompt.
   * @param {string} prompt - Describe the UI component (e.g., "A premium membership card with gold accents")
   */
  async generateComponent(prompt) {
    if (!this.client) {
      return {
        success: false,
        message: 'No API Key. Please use the Stitch Web UI and export the code manually to assets/stitch-exports/',
        previewContent: `<div class="p-6 bg-zinc-900 border border-gold/30 rounded-2xl text-gold">Stitch Preview: ${prompt}</div>`
      };
    }

    try {
      const result = await this.client.generateUI({ prompt });
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export const stitch = new StitchClient();
