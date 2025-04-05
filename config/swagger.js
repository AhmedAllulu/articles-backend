// config/swagger.js
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const constants = require('./constants');
const countries = require('./countries');
const packageJson = require('../package.json'); // Add this to get version from package.json

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'News Generation API',
    version: packageJson.version || '1.0.0',
    description: 'API for generating and managing news articles based on trending topics',
    contact: {
      name: 'API Support',
      email: 'support@example.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
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
    },
    {
      name: 'Authentication',
      description: 'User authentication and authorization'
    },
    {
      name: 'Health',
      description: 'API health and status monitoring'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token in the format: Bearer {token}'
      }
    },
    schemas: {
      Article: {
        type: 'object',
        required: ['title', 'content', 'trend_keyword', 'language'],
        properties: {
          id: {
            type: 'integer',
            example: 42,
            description: 'Unique identifier for the article'
          },
          title: {
            type: 'string',
            example: 'New Breakthrough in Quantum Computing',
            description: 'Article headline'
          },
          content: {
            type: 'string',
            example: 'Scientists have made a significant breakthrough in quantum computing...',
            description: 'Main article content'
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp'
          },
          updated_at: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Last update timestamp'
          },
          trend_keyword: {
            type: 'string',
            example: 'quantum computing',
            description: 'Trending keyword this article is based on'
          },
          language: {
            type: 'string',
            example: 'en',
            description: 'Language code (ISO 639-1)'
          },
          image_url: {
            type: 'string',
            example: 'https://example.com/images/quantum-computer.jpg',
            nullable: true,
            description: 'Featured image URL'
          }
        }
      },
      ArticlesList: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true
          },
          data: {
            type: 'object',
            properties: {
              articles: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/Article'
                }
              },
              pagination: {
                type: 'object',
                properties: {
                  total: {
                    type: 'integer',
                    example: 100
                  },
                  limit: {
                    type: 'integer',
                    example: 10
                  },
                  offset: {
                    type: 'integer',
                    example: 0
                  },
                  hasMore: {
                    type: 'boolean',
                    example: true
                  }
                }
              }
            }
          },
          message: {
            type: 'string',
            example: 'Success'
          },
          timestamp: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      Trend: {
        type: 'object',
        required: ['keyword'],
        properties: {
          id: {
            type: 'integer',
            example: 123,
            description: 'Unique identifier for the trend'
          },
          keyword: {
            type: 'string',
            example: 'artificial intelligence',
            description: 'Trending keyword or phrase'
          },
          status: {
            type: 'string',
            enum: Object.values(constants.TREND_STATUS),
            example: 'not_used',
            description: 'Status indicating if this trend has been used for article generation'
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            description: 'When trend was first recorded'
          },
          used_at: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'When trend was used for article generation'
          }
        }
      },
      TrendsList: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true
          },
          data: {
            type: 'object',
            properties: {
              trends: {
                type: 'array',
                items: {
                  type: 'string'
                },
                example: ['artificial intelligence', 'quantum computing', 'blockchain']
              },
              category: {
                type: 'string',
                example: 'tech'
              },
              countryCode: {
                type: 'string',
                example: 'US'
              }
            }
          },
          message: {
            type: 'string',
            example: 'Success'
          },
          timestamp: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      User: {
        type: 'object',
        required: ['email', 'name'],
        properties: {
          id: {
            type: 'integer',
            example: 1,
            description: 'Unique identifier for the user'
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'user@example.com',
            description: 'User email address (used for login)'
          },
          name: {
            type: 'string',
            example: 'John Doe',
            description: 'User full name'
          },
          role: {
            type: 'string',
            enum: ['admin', 'editor'],
            example: 'editor',
            description: 'User role that determines permissions'
          },
          lastLogin: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Last login timestamp'
          }
        }
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['healthy', 'unhealthy', 'error'],
            example: 'healthy',
            description: 'Overall system health status'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when health check was performed'
          },
          responseTime: {
            type: 'string',
            example: '120ms',
            description: 'Time taken to complete health check'
          },
          version: {
            type: 'string',
            example: '1.0.0',
            description: 'API version'
          },
          checks: {
            type: 'object',
            properties: {
              database: {
                type: 'object',
                properties: {
                  status: {
                    type: 'string',
                    enum: ['healthy', 'unhealthy'],
                    example: 'healthy'
                  },
                  message: {
                    type: 'string',
                    example: 'Database connection is working'
                  },
                  dbTime: {
                    type: 'string',
                    format: 'date-time',
                    description: 'Current database server time'
                  }
                }
              },
              system: {
                type: 'object',
                properties: {
                  status: {
                    type: 'string',
                    enum: ['healthy', 'unhealthy'],
                    example: 'healthy'
                  },
                  uptime: {
                    type: 'string',
                    example: '5d 12h 30m 15s'
                  },
                  load: {
                    type: 'object',
                    properties: {
                      '1m': { type: 'string', example: '0.25' },
                      '5m': { type: 'string', example: '0.30' },
                      '15m': { type: 'string', example: '0.35' }
                    }
                  }
                }
              },
              memory: {
                type: 'object',
                properties: {
                  status: {
                    type: 'string',
                    enum: ['healthy', 'unhealthy'],
                    example: 'healthy'
                  },
                  total: {
                    type: 'string',
                    example: '16 GB'
                  },
                  used: {
                    type: 'string',
                    example: '8.5 GB'
                  },
                  free: {
                    type: 'string',
                    example: '7.5 GB'
                  },
                  usagePercent: {
                    type: 'string',
                    example: '53.12%'
                  }
                }
              },
              disk: {
                type: 'object',
                properties: {
                  status: {
                    type: 'string',
                    enum: ['healthy', 'unhealthy', 'unknown'],
                    example: 'healthy'
                  },
                  filesystem: {
                    type: 'string',
                    example: '/dev/sda1'
                  },
                  size: {
                    type: 'string',
                    example: '100G'
                  },
                  used: {
                    type: 'string',
                    example: '45G'
                  },
                  available: {
                    type: 'string',
                    example: '55G'
                  },
                  usagePercent: {
                    type: 'string',
                    example: '45%'
                  }
                }
              }
            }
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
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            example: 'user@example.com'
          },
          password: {
            type: 'string',
            format: 'password',
            example: 'SecurePassword123!'
          }
        }
      },
      LoginResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true
          },
          data: {
            type: 'object',
            properties: {
              user: {
                $ref: '#/components/schemas/User'
              },
              token: {
                type: 'string',
                example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
              }
            }
          },
          message: {
            type: 'string',
            example: 'Login successful'
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
        example: 'tech',
        description: 'News category'
      },
      CountryCodeParam: {
        type: 'string',
        enum: countries.map(c => c.code),
        example: 'US',
        description: 'Country code (ISO 3166-1 alpha-2)'
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
      },
      keywordParam: {
        name: 'keyword',
        in: 'path',
        required: true,
        schema: {
          type: 'string'
        },
        description: 'Trending keyword'
      },
      idParam: {
        name: 'id',
        in: 'path',
        required: true,
        schema: {
          type: 'integer',
          minimum: 1
        },
        description: 'Resource ID'
      },
      searchQueryParam: {
        name: 'query',
        in: 'query',
        required: true,
        schema: {
          type: 'string',
          minLength: 2
        },
        description: 'Search query string'
      }
    },
    responses: {
      UnauthorizedError: {
        description: 'Authentication information is missing or invalid',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              error: {
                message: 'Authentication required',
                status: 401
              },
              timestamp: '2023-06-15T12:00:00Z'
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
            },
            example: {
              success: false,
              error: {
                message: 'Insufficient permissions',
                status: 403
              },
              timestamp: '2023-06-15T12:00:00Z'
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
            },
            example: {
              success: false,
              error: {
                message: 'Resource not found',
                status: 404
              },
              timestamp: '2023-06-15T12:00:00Z'
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
            },
            example: {
              success: false,
              error: {
                message: 'Invalid input: email must be a valid email address',
                status: 400
              },
              timestamp: '2023-06-15T12:00:00Z'
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
            },
            example: {
              success: false,
              error: {
                message: 'Internal server error',
                status: 500
              },
              timestamp: '2023-06-15T12:00:00Z'
            }
          }
        }
      },
      RateLimitError: {
        description: 'Too many requests',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              error: {
                message: 'Too many requests, please try again later.',
                status: 429
              },
              timestamp: '2023-06-15T12:00:00Z'
            }
          }
        }
      }
    },
    examples: {
      Article: {
        value: {
          id: 42,
          title: 'New Breakthrough in Quantum Computing',
          content: 'Scientists have made a significant breakthrough in quantum computing that could revolutionize the field...',
          created_at: '2023-06-15T10:30:00Z',
          updated_at: '2023-06-15T11:45:00Z',
          trend_keyword: 'quantum computing',
          language: 'en',
          image_url: 'https://example.com/images/quantum-computer.jpg'
        }
      },
      Trend: {
        value: {
          id: 123,
          keyword: 'artificial intelligence',
          status: 'not_used',
          created_at: '2023-06-14T08:15:00Z',
          used_at: null
        }
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ]
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
  const swaggerUiOptions = {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha'
    }
  };
  
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
  
  // Serve swagger spec as JSON
  app.get('/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
  
  // Add version endpoint to get API info
  app.get('/api/version', (req, res) => {
    res.json({
      name: swaggerDefinition.info.title,
      version: swaggerDefinition.info.version,
      description: swaggerDefinition.info.description,
      documentation: `${req.protocol}://${req.get('host')}/api-docs`
    });
  });
  
  console.log(`Swagger documentation available at: /api-docs`);
}

module.exports = {
  setupSwagger,
  swaggerSpec
};