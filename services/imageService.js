// services/imageService.js
const axios = require('axios');
const logger = require('../config/logger');
const crypto = require('crypto');

class ImageService {
  /**
   * Generate an image for an article using third-party API
   * @param {string} keyword - Keyword to generate image for
   * @param {string} title - Article title
   * @param {string} languageCode - Language code
   * @returns {Promise<string>} URL of generated image
   */
  async generateImage(keyword, title, languageCode) {
    try {
      logger.info(`Generating image for "${keyword}" in ${languageCode}`);
      
      // Create prompt for image generation
      const prompt = this._createImagePrompt(keyword, title);
      
      // Make API call to image generation service
      const response = await axios.post(
        process.env.IMAGE_API_URL,
        {
          prompt,
          n: 1,
          size: '1024x1024',
          response_format: 'url'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.IMAGE_API_KEY}`
          }
        }
      );
      
      // Extract image URL from response
      if (response.data && response.data.data && response.data.data.length > 0) {
        const imageUrl = response.data.data[0].url;
        logger.info(`Successfully generated image for "${keyword}"`);
        return imageUrl;
      }
      
      logger.warn(`No image URL in response for "${keyword}"`);
      return this._getFallbackImageUrl(keyword, languageCode);
    } catch (error) {
      logger.error(`Error generating image for "${keyword}": ${error.message}`);
      return this._getFallbackImageUrl(keyword, languageCode);
    }
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
   * Create a prompt for image generation
   * @private
   * @param {string} keyword - Keyword for image
   * @param {string} title - Article title
   * @returns {string} Formatted prompt
   */
  _createImagePrompt(keyword, title) {
    // Use both keyword and title to create a more relevant image
    return `High-quality photojournalistic image representing: ${keyword} - ${title}. 
      Realistic style, professional composition, news-worthy.`;
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