// services/deepSeekService.js
const axios = require('axios');
const logger = require('../config/logger');

class DeepSeekService {
  constructor() {
    // Configure retries
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second delay between retries
    
    // Cache for successful responses
    this.cache = new Map();
    this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
  }
  
  /**
   * Generate an article using DeepSeek API with retries and fallback
   * @param {string} keyword - Trending keyword to base the article on
   * @param {string} language - Language code to generate the article in
   * @param {string} countryCode - Country code for localization
   * @returns {Promise<Object>} Generated article with title and content
   */
  async generateArticle(keyword, language, countryCode) {
    // Check cache first
    const cacheKey = `${keyword}:${language}:${countryCode}`;
    const cachedArticle = this._getFromCache(cacheKey);
    if (cachedArticle) {
      logger.info(`Using cached article for "${keyword}"`);
      return cachedArticle;
    }
    
    try {
      logger.info(`Generating article for "${keyword}" in ${language} (${countryCode})`);
      
      // Check if we're in discount hours to log API usage cost
      const now = new Date();
      const hour = now.getHours();
      const isDiscountHour = hour >= 16 && hour < 24; // 4 PM to midnight
      logger.info(`API call during ${isDiscountHour ? 'discount' : 'regular'} hours`);
      
      // Attempt API call with retries
      let lastError;
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          // Create prompt for DeepSeek
          const prompt = this._createPrompt(keyword, language, countryCode);
          
          // Make API call to DeepSeek
          const response = await axios.post(
            process.env.DEEPSEEK_API_URL,
            {
              model: "deepseek-chat",  // Updated model name (use the appropriate model)
              messages: [
                {
                  role: "user",
                  content: prompt
                }
              ],
              temperature: 0.7,
              max_tokens: 4000
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
              },
              timeout: 30000 // 30 second timeout
            }
          );
          
          // Parse the response
          if (response.data && response.data.choices && response.data.choices.length > 0) {
            const generatedText = response.data.choices[0].message.content;
            
            // Extract title and content from generated text
            const article = this._parseGeneratedContent(generatedText);
            
            // Cache the successful result
            this._addToCache(cacheKey, article);
            
            logger.info(`Successfully generated article for "${keyword}" (${article.title.substring(0, 30)}...)`);
            return article;
          }
          
          throw new Error('Invalid response from DeepSeek API');
        } catch (error) {
          lastError = error;
          logger.warn(`Attempt ${attempt}/${this.maxRetries} failed for "${keyword}": ${error.message}`);
          
          if (attempt < this.maxRetries) {
            // Wait before retrying with exponential backoff
            const delay = this.retryDelay * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      // If all retries failed, fall back to template
      logger.error(`All attempts failed for "${keyword}". Using fallback.`);
      return this._generateFallbackArticle(keyword, language, countryCode);
    } catch (error) {
      logger.error(`Error generating article for "${keyword}": ${error.message}`);
      return this._generateFallbackArticle(keyword, language, countryCode);
    }
  }
  
  /**
   * Generate a fallback article when the API fails
   * @private
   * @param {string} keyword - Trending keyword
   * @param {string} language - Language code
   * @param {string} countryCode - Country code
   * @returns {Object} Fallback article with title and content
   */
  _generateFallbackArticle(keyword, language, countryCode) {
    logger.info(`Generating fallback article for "${keyword}"`);
    
    // Create a basic article title
    const title = `${keyword.charAt(0).toUpperCase() + keyword.slice(1)}: Latest Developments`;
    
    // Create template content
    const content = `
      This is an overview of the latest developments related to ${keyword}.
      
      The trending topic of ${keyword} has been gaining attention recently. 
      Experts in the field have noted several key developments that are worth following.
      
      While specific details are still emerging, the significance of ${keyword} continues to grow.
      
      Stay tuned for more updates on this developing story as new information becomes available.
    `.trim().replace(/\n\s+/g, '\n\n');
    
    const fallbackArticle = { title, content };
    
    // Cache the fallback article too
    const cacheKey = `${keyword}:${language}:${countryCode}`;
    this._addToCache(cacheKey, fallbackArticle);
    
    return fallbackArticle;
  }
  
  /**
   * Create a prompt for the DeepSeek API
   * @private
   * @param {string} keyword - Trending keyword
   * @param {string} language - Language code
   * @param {string} countryCode - Country code
   * @returns {string} Formatted prompt
   */
  _createPrompt(keyword, language, countryCode) {
    return `
      You are a professional journalist writing a news article about the trending topic: "${keyword}".
      
      Write a comprehensive, factual news article in ${language} language that would be appropriate for readers in ${countryCode}.
      
      The article should:
      1. Have a clear, engaging headline
      2. Include an introduction, body, and conclusion
      3. Be factual and informative
      4. Be between 500-800 words
      5. Use formal journalistic style appropriate for a news website
      
      Format your response as:
      
      TITLE: [Your headline here]
      
      [Article content here]
    `;
  }
  
  /**
   * Parse generated content into title and body
   * @private
   * @param {string} generatedText - Raw text from DeepSeek API
   * @returns {Object} Object with title and content
   */
  _parseGeneratedContent(generatedText) {
    // Simple parsing for demonstration
    // In production, you might need more robust parsing
    const titleMatch = generatedText.match(/TITLE:\s*(.*?)(?:\n|$)/);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled Article';
    
    // Extract content (everything after TITLE: line)
    let content = generatedText.replace(/TITLE:\s*(.*?)(?:\n|$)/, '').trim();
    
    return {
      title,
      content
    };
  }
  
  /**
   * Add an article to the cache
   * @private
   * @param {string} key - Cache key
   * @param {Object} article - Article object
   */
  _addToCache(key, article) {
    this.cache.set(key, {
      article,
      timestamp: Date.now()
    });
    
    // Schedule cache cleanup
    setTimeout(() => {
      this._cleanupCache();
    }, this.cacheTimeout);
  }
  
  /**
   * Get an article from the cache if it exists and is still valid
   * @private
   * @param {string} key - Cache key
   * @returns {Object|null} Article object or null if not found or expired
   */
  _getFromCache(key) {
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.article;
    }
    
    return null;
  }
  
  /**
   * Clean up expired cache entries
   * @private
   */
  _cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }
}

module.exports = new DeepSeekService();