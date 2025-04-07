// services/deepSeekTrendsService.js
const logger = require('../config/logger');
const OpenAI = require('openai');

class DeepSeekTrendsService {
  constructor() {
    // Cache for successful responses
    this.cache = new Map();
    this.cacheTimeout = 60 * 60 * 1000; // 1 hour cache
    
    // Initialize OpenAI client with DeepSeek configuration
    this.openai = new OpenAI({ 
      baseURL: process.env.DEEPSEEK_API_URL,
      apiKey: process.env.DEEPSEEK_API_KEY
    });
  }
  
  /**
   * Get trending keywords for a category, country, and language using DeepSeek
   * @param {string} category - Category (tech, sports, politics, health, general)
   * @param {string} countryCode - Country code (US, DE, FR, etc.)
   * @param {string} language - Language code (en, de, fr, etc.)
   * @param {number} limit - Maximum number of keywords to return
   * @returns {Promise<Array<string>>} Array of trending keywords
   */
  async getTrendingKeywords(category, countryCode, language, limit = 20) {
    try {
      logger.info(`Generating trending keywords for ${category} in ${countryCode} (${language}) using DeepSeek`);
      
      // Check cache first
      const cacheKey = `${category}:${countryCode}:${language}`;
      const cachedKeywords = this._getFromCache(cacheKey);
      
      if (cachedKeywords) {
        logger.info(`Using cached trending keywords for ${category} in ${countryCode} (${language})`);
        return cachedKeywords.slice(0, limit);
      }
      
      // Get the country name from country code for a better prompt
      const countryName = this._getCountryName(countryCode);
      
      // Create prompt for DeepSeek
      const prompt = this._createPrompt(category, countryName, language);
      
      // Make API call to DeepSeek using OpenAI compatibility interface
      const response = await this.openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are a knowledgeable assistant who keeps up with current global trends (Search the web for today's trending topics)."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });
      
      // Parse the response
      if (response.choices && response.choices.length > 0) {
        const generatedText = response.choices[0].message.content;
        const keywords = this._parseKeywords(generatedText);
        
        // Cache the keywords
        this._addToCache(cacheKey, keywords);
        
        logger.info(`Generated ${keywords.length} trending keywords for ${category} in ${countryCode} (${language})`);
        return keywords.slice(0, limit);
      }
      
      throw new Error('Invalid response from DeepSeek API');
    } catch (error) {
      logger.error(`Error generating trending keywords: ${error.message}`);
      // Return fallback keywords for the category
      return this._getFallbackKeywords(category, language);
    }
  }
  
  /**
   * Create a prompt for DeepSeek to generate trending keywords
   * @private
   * @param {string} category - Category
   * @param {string} countryName - Country name
   * @param {string} language - Language code
   * @returns {string} Formatted prompt
   */
  _createPrompt(category, countryName, language) {
    // Different prompts for different categories to enhance relevance
    const categoryDescriptions = {
      tech: "technology, innovation, digital products, software, hardware, IT companies, and tech industry",
      sports: "sports events, competitions, athletes, teams, tournaments, and sports news",
      politics: "politics, government, elections, policies, international relations, and political figures",
      health: "health, medicine, wellness, fitness, healthcare, nutrition, and medical research",
      general: "general news, current events, social issues, culture, entertainment, and global affairs"
    };
    
    const description = categoryDescriptions[category] || categoryDescriptions.general;
    
    return `Generate a list of 30 trending keywords related to ${description} that would be popular in ${countryName} right now.

The keywords should be:
1. In the ${language} language
2. Relevant to current trends and events
3. Each keyword or phrase should be 1-4 words
4. Focused specifically on ${category} topics
5. Realistic and something people would actually search for
6. Representative of what might be trending right now in ${countryName}

Format your response as a JSON array of strings, like this:
["keyword 1", "keyword 2", "keyword 3", ...]

For example, if the category is tech and the country is USA, you might return:
["artificial intelligence", "quantum computing", "foldable phones", "cloud security"]`;
  }
  
  /**
   * Parse keywords from the DeepSeek response
   * @private
   * @param {string} text - Raw response text
   * @returns {Array<string>} Array of keywords
   */
  _parseKeywords(text) {
    try {
      // Try to extract JSON array
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        const keywords = JSON.parse(jsonStr);
        
        // Ensure it's an array of strings
        if (Array.isArray(keywords) && keywords.every(k => typeof k === 'string')) {
          return keywords.filter(k => k.trim().length > 0);
        }
      }
      
      // If JSON parsing fails, try line-by-line extraction
      const lines = text.split('\n');
      const keywords = [];
      
      for (const line of lines) {
        // Look for patterns like "1. keyword" or "- keyword" or just "keyword"
        const match = line.match(/(?:^\d+\.\s*|\-\s*|^)["']?([^"']+)["']?,?$/);
        if (match && match[1] && match[1].trim().length > 0) {
          keywords.push(match[1].trim());
        }
      }
      
      return keywords;
    } catch (error) {
      logger.error(`Error parsing keywords: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get country name from country code
   * @private
   * @param {string} countryCode - ISO country code
   * @returns {string} Country name
   */
  _getCountryName(countryCode) {
    const countries = require('../config/countries');
    const country = countries.find(c => c.code === countryCode);
    return country ? country.country : countryCode;
  }
  
  /**
   * Add keywords to the cache
   * @private
   * @param {string} key - Cache key
   * @param {Array<string>} keywords - Keywords to cache
   */
  _addToCache(key, keywords) {
    this.cache.set(key, {
      keywords,
      timestamp: Date.now()
    });
  }
  
  /**
   * Get keywords from the cache if still valid
   * @private
   * @param {string} key - Cache key
   * @returns {Array<string>|null} Keywords or null if not found or expired
   */
  _getFromCache(key) {
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.keywords;
    }
    
    return null;
  }
  
  /**
   * Get fallback keywords if DeepSeek fails
   * @private
   * @param {string} category - Category
   * @param {string} language - Language code
   * @returns {Array<string>} Fallback keywords
   */
  _getFallbackKeywords(category, language = 'en') {
    // Common fallbacks across all languages
    const commonFallbacks = {
      tech: [
        'artificial intelligence', 'quantum computing', 'blockchain', 
        'cloud computing', 'cybersecurity', '5G technology',
        'machine learning', 'augmented reality', 'virtual reality',
        'big data', 'self-driving cars', 'smart home'
      ],
      sports: [
        'Olympic games', 'football', 'basketball', 'tennis',
        'golf', 'soccer', 'baseball', 'NFL', 'NBA',
        'athletics', 'swimming', 'cycling'
      ],
      politics: [
        'elections', 'government policy', 'international relations',
        'United Nations', 'climate agreement', 'economic policy',
        'trade agreements', 'political reform', 'democracy',
        'legislation', 'foreign policy', 'domestic policy'
      ],
      health: [
        'nutrition', 'mental health', 'fitness', 'meditation',
        'healthcare', 'medical research', 'disease prevention',
        'vaccines', 'public health', 'telemedicine',
        'wellness', 'healthy diet'
      ],
      general: [
        'climate change', 'economy', 'education', 'entertainment',
        'environment', 'science', 'social media', 'travel',
        'tourism', 'remote work', 'inflation', 'sustainability'
      ]
    };
    
    // Language-specific fallbacks (for common languages)
    const languageFallbacks = {
      // German keywords
      de: {
        tech: [
          'künstliche Intelligenz', 'Quantencomputer', 'Blockchain',
          'Cloud Computing', 'Cybersicherheit', '5G Technologie',
          'maschinelles Lernen', 'erweiterte Realität', 'virtuelle Realität'
        ],
        // Other categories would be included here
      },
      // Other languages would be included here
    };
    
    // Use language-specific fallbacks if available, otherwise use common ones
    if (languageFallbacks[language] && languageFallbacks[language][category]) {
      return languageFallbacks[language][category];
    }
    
    return commonFallbacks[category] || commonFallbacks.general;
  }
}

module.exports = new DeepSeekTrendsService();