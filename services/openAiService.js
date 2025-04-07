// services/openAiService.js
const logger = require('../config/logger');
const OpenAI = require('openai');

class OpenAIService {
  constructor() {
    // Configure retries
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second delay between retries
    
    // Cache for successful responses
    this.cache = new Map();
    this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
    
    // Initialize OpenAI client
    this.openai = new OpenAI({ 
      baseURL: process.env.OpenAI_API_URL,
      apiKey: process.env.OpenAI_API_KEY
    });
  }
  
  /**
   * Generate an article using OpenAI with retries
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

    logger.info(`Generating article for "${keyword}" in ${language} (${countryCode})`);

    // Attempt API call with retries
    let lastError;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Create prompt based on keyword
        const prompt = this._createSearchQuery(keyword, language, countryCode);

        // Make API call to OpenAI
        const response = await this.openai.completions.create({
          model: "gpt-4o-mini-search-preview-2025-03-11", // Adjust to the appropriate OpenAI model
          prompt: prompt,
          temperature: 0.7,
          max_tokens: 2000
        });

        // Extract title and content from generated text
        const generatedText = response.choices[0].text;
        const article = this._parseGeneratedContent(generatedText);

        // Cache the successful result
        this._addToCache(cacheKey, article);

        logger.info(`Successfully generated article for "${keyword}" (${article.title.substring(0, 30)}...)`);
        return article;
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

    // If all retries failed, throw the error
    logger.error(`All attempts failed for "${keyword}". Error: ${lastError.message}`);
    throw new Error(`Failed to generate article for "${keyword}" after ${this.maxRetries} attempts: ${lastError.message}`);
  }
  
  /**
   * Create a search query for the OpenAI API
   * @private
   * @param {string} keyword - Trending keyword
   * @param {string} language - Language code
   * @param {string} countryCode - Country code
   * @returns {string} Formatted search query
   */
  _createSearchQuery(keyword, language, countryCode) {
    return `
      You are a professional journalist writing a news article about the trending topic: "${keyword}".
      
      Write a comprehensive, factual news article in ${language} language that would be appropriate for readers in ${countryCode}.
      
      The article should:
      1. Have a clear, engaging headline
      2. Include an introduction, body, and conclusion
      3. Be factual and informative
      4. Be between 800-1200 words
      5. Use formal journalistic style appropriate for a news website
      
      Format your response as:
      
      TITLE: [Your headline here]
      
      [Article content here]
    `;
  }
  
  /**
   * Parse generated content into title and body
   * @private
   * @param {string} generatedText - Raw text from OpenAI API
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

module.exports = new OpenAIService();