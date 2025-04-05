// services/imageService.js
const axios = require('axios');
const logger = require('../config/logger');
const crypto = require('crypto');

class ImageService {
  /**
   * Generate an image for an article using Pixabay API
   * @param {string} keyword - Keyword to generate image for
   * @param {string} title - Article title
   * @param {string} languageCode - Language code
   * @returns {Promise<string>} URL of generated image
   */
  async generateImage(keyword, title, languageCode) {
    try {
      logger.info(`Generating image for "${keyword}" in ${languageCode}`);
      
      // Create search query for Pixabay
      const searchQuery = this._createSearchQuery(keyword, title);
      
      // Make API call to Pixabay
      const response = await axios.get(
        process.env.PIXABAY_API_URL,
        {
          params: {
            key: process.env.PIXABAY_API_KEY,
            q: searchQuery,
            lang: this._mapLanguageCode(languageCode),
            image_type: 'photo',
            orientation: 'horizontal',
            safesearch: true,
            per_page: 3, // Get a few options to choose from
            order: 'popular'
          }
        }
      );
      
      // Extract image URL from response
      if (response.data && response.data.hits && response.data.hits.length > 0) {
        // Prefer larger images for article headers
        const imageUrl = response.data.hits[0].largeImageURL;
        logger.info(`Successfully found image for "${keyword}"`);
        return imageUrl;
      }
      
      logger.warn(`No image found in Pixabay for "${keyword}"`);
      return this._getFallbackImageUrl(keyword, languageCode);
    } catch (error) {
      logger.error(`Error generating image for "${keyword}": ${error.message}`);
      return this._getFallbackImageUrl(keyword, languageCode);
    }
  }
  
  /**
   * Map language code to Pixabay supported languages
   * @private
   * @param {string} languageCode - ISO language code
   * @returns {string} Pixabay supported language code
   */
  _mapLanguageCode(languageCode) {
    // Pixabay supports these language codes: cs, da, de, en, es, fr, id, it, hu, nl, no, pl, pt, ro, sk, fi, sv, tr, vi, th, bg, ru, el, ja, ko, zh
    const supportedLanguages = ['cs', 'da', 'de', 'en', 'es', 'fr', 'id', 'it', 'hu', 'nl', 'no', 'pl', 'pt', 'ro', 'sk', 'fi', 'sv', 'tr', 'vi', 'th', 'bg', 'ru', 'el', 'ja', 'ko', 'zh'];
    
    // Extract the base language code (e.g., 'en-US' -> 'en')
    const baseCode = languageCode.split('-')[0].toLowerCase();
    
    // Return the base code if supported, otherwise default to English
    return supportedLanguages.includes(baseCode) ? baseCode : 'en';
  }
  
  /**
   * Get a fallback image URL if generation fails
   * @private
   * @param {string} keyword - Keyword for image
   * @param {string} languageCode - Language code
   * @returns {string} Fallback image URL
   */
  _getFallbackImageUrl(keyword, languageCode) {
    // Generate a deterministic but reasonably unique hash for the keyword
    const hash = crypto.createHash('md5').update(keyword).digest('hex');
    
    // Use a placeholder image service with the hash for variety
    return `https://picsum.photos/seed/${hash}/1024/768`;
  }
  
  /**
   * Create a search query for image generation
   * @private
   * @param {string} keyword - Keyword for image
   * @param {string} title - Article title
   * @returns {string} Formatted search query
   */
  _createSearchQuery(keyword, title) {
    // Focus on the keyword for better results, but add some context from the title
    // Clean up and limit query length to avoid API issues
    const titleWords = title.split(/\s+/).slice(0, 3).join(' ');
    const query = `${keyword} ${titleWords}`;
    
    // Remove special characters that might affect searching
    return query.replace(/[^\w\s]/gi, '').trim();
  }
  
  /**
   * Store image in cloud storage for performance (placeholder implementation)
   * @param {string} imageUrl - Original image URL
   * @param {string} category - Article category
   * @param {string} countryCode - Country code
   * @returns {Promise<string>} Stored image URL
   */
  async storeImage(imageUrl, category, countryCode) {
    // This would typically download the image from the original URL
    // and upload it to a CDN or cloud storage (AWS S3, Google Cloud Storage, etc.)
    // For now, we'll just return the original URL
    return imageUrl;
  }
}

module.exports = new ImageService();