// config/swagger.js
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const constants = require('./constants');
const countries = require('./countries');

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'News Generation API',
    version: '1.0.0',
    description: 'API for generating and managing news articles based on trending topics',
    contact: {
      name: 'API Support',
      email: 'support@example.com'
    }
  },
  servers: [
    {
      url: process.env.NODE_ENV === 'production' 
        ? 'https://api.example.com/v1' 
        : `http://localhost:${process.env.PORT || 3000}/api`,
      description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
    }
  ],
  tags: [
    {
      name: 'Articles',
      description: 'Operations related to articles'
    },
    {
      name: 'Trends',
      description: 'Operations related to trending topics'
    },
    {
      name: 'Admin',
      description: 'Administrative operations'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      Article: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            example: 42
          },
          title: {
            type: 'string',
            example: 'New Breakthrough in Quantum Computing'
          },
          content: {
            type: 'string',
            example: 'Scientists have made a significant breakthrough in quantum computing...'
          },
          created_at: {
            type: 'string',
            format: 'date-time'
          },
          updated_at: {
            type: 'string',
            format: 'date-time',
            nullable: true
          },
          trend_keyword: {
            type: 'string',
            example: 'quantum computing'
          },
          language: {
            type: 'string',
            example: 'en'
          },
          image_url: {
            type: 'string',
            example: 'https://example.com/images/quantum-computer.jpg',
            nullable: true
          }
        }
      },
      Trend: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            example: 123
          },
          keyword: {
            type: 'string',
            example: 'artificial intelligence'
          },
          status: {
            type: 'string',
            enum: Object.values(constants.TREND_STATUS),
            example: 'not_used'
          },
          created_at: {
            type: 'string',
            format: 'date-time'
          },
          used_at: {
            type: 'string',
            format: 'date-time',
            nullable: true
          }
        }
      },
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false
          },
          error: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                example: 'Error message'
              },
              status: {
                type: 'integer',
                example: 400
              }
            }
          },
          timestamp: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      CategoryParam: {
        type: 'string',
        enum: constants.CATEGORIES,
        example: 'tech'
      },
      CountryCodeParam: {
        type: 'string',
        enum: countries.map(c => c.code),
        example: 'US'
      }
    },
    parameters: {
      categoryParam: {
        name: 'category',
        in: 'path',
        required: true,
        schema: {
          $ref: '#/components/schemas/CategoryParam'
        },
        description: 'Category name'
      },
      countryCodeParam: {
        name: 'countryCode',
        in: 'path',
        required: true,
        schema: {
          $ref: '#/components/schemas/CountryCodeParam'
        },
        description: 'Country code'
      },
      limitParam: {
        name: 'limit',
        in: 'query',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 10
        },
        description: 'Maximum number of items to return'
      },
      offsetParam: {
        name: 'offset',
        in: 'query',
        required: false,
        schema: {
          type: 'integer',
          minimum: 0,
          default: 0
        },
        description: 'Number of items to skip for pagination'
      }
    },
    responses: {
      UnauthorizedError: {
        description: 'Authentication information is missing or invalid',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      ForbiddenError: {
        description: 'Not enough permissions to perform the action',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      ValidationError: {
        description: 'Invalid input data',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      ServerError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      }
    }
  }
};

// Options for the swagger docs
const options = {
  swaggerDefinition,
  apis: [
    './routes/*.js',
    './controllers/*.js',
    './middleware/*.js',
    './models/*.js'
  ],
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJSDoc(options);

// Setup Swagger middleware
function setupSwagger(app) {
  // Serve swagger docs
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }'
  }));
  
  // Serve swagger spec as JSON
  app.get('/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

module.exports = {
  setupSwagger
};