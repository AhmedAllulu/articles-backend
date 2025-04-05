
// services/deepSeekService.js
const axios = require('axios');
const logger = require('../config/logger');

class DeepSeekService {
  /**
   * Generate an article using DeepSeek API
   * @param {string} keyword - Trending keyword to base the article on
   * @param {string} language - Language code to generate the article in
   * @param {string} countryCode - Country code for localization
   * @returns {Promise<Object>} Generated article with title and content
   */
  async generateArticle(keyword, language, countryCode) {
    try {
      logger.info(`Generating article for "${keyword}" in ${language} (${countryCode})`);
      
      // Check if we're in discount hours to log API usage cost
      const now = new Date();
      const hour = now.getHours();
      const isDiscountHour = hour >= 16 && hour < 24; // 4 PM to midnight
      logger.info(`API call during ${isDiscountHour ? 'discount' : 'regular'} hours`);
      
      // Create prompt for DeepSeek to generate an article
      const prompt = this._createPrompt(keyword, language, countryCode);
      
      // Make API call to DeepSeek
      const response = await axios.post(
        process.env.DEEPSEEK_API_URL,
        {
          model: "deepseek-llm",
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
          }
        }
      );
      
      // Parse the response
      if (response.data && response.data.choices && response.data.choices.length > 0) {
        const generatedText = response.data.choices[0].message.content;
        
        // Extract title and content from generated text
        // This assumes DeepSeek returns the content in a specific format
        const article = this._parseGeneratedContent(generatedText);
        
        logger.info(`Successfully generated article for "${keyword}" (${article.title.substring(0, 30)}...)`);
        return article;
      }
      
      throw new Error('Invalid response from DeepSeek API');
    } catch (error) {
      logger.error(`Error generating article for "${keyword}": ${error.message}`);
      throw error;
    }
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
}

module.exports = new DeepSeekService();