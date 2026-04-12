/**
 * OpenAPI 3.0 specification for Intelli-Mock API.
 * This specification documents all API routes for interactive Swagger UI.
 */
export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Intelli-Mock API',
    description:
      'AI-powered API mocking platform for teams. Generate mock scripts from sample request/response pairs using AI, with full multi-tenant isolation.',
    version: '1.0.0',
    contact: {
      name: 'Intelli-Mock',
      url: 'https://github.com/intelli-mock',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
  tags: [
    {
      name: 'Mocks',
      description: 'Mock endpoint management — CRUD operations',
    },
    {
      name: 'Samples',
      description: 'Sample request/response pair management',
    },
    {
      name: 'Scripts',
      description: 'Mock script testing and execution',
    },
    {
      name: 'Traffic',
      description: 'Traffic log viewing and management',
    },
    {
      name: 'Runtime',
      description: 'Runtime mock and auto endpoints',
    },
  ],
  paths: {
    '/api/mocks': {
      post: {
        tags: ['Mocks'],
        summary: 'Create a new mock endpoint',
        description: 'Create a new mock endpoint with configuration options.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['pathPattern', 'method'],
                properties: {
                  pathPattern: {
                    type: 'string',
                    example: '/test/:id',
                  },
                  method: {
                    type: 'string',
                    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
                    example: 'GET',
                  },
                  proxyUrl: {
                    type: 'string',
                    format: 'uri',
                    example: 'https://api.example.com/test',
                  },
                  promptExtra: {
                    type: 'string',
                    example: 'Return a user with the given ID',
                  },
                  priority: {
                    type: 'number',
                    example: 0,
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Mock endpoint created successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MockEndpoint',
                },
              },
            },
          },
          400: {
            description: 'Invalid request body',
          },
          401: {
            description: 'Unauthorized — missing or invalid JWT',
          },
        },
      },
      get: {
        tags: ['Mocks'],
        summary: 'List all mock endpoints',
        description: 'Retrieve all mock endpoints scoped to the current tenant.',
        parameters: [
          {
            name: 'status',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['draft', 'ready', 'active', 'deactivated'],
            },
            description: 'Filter by status',
          },
          {
            name: 'method',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
            },
            description: 'Filter by HTTP method',
          },
        ],
        responses: {
          200: {
            description: 'List of mock endpoints',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/MockEndpointSummary',
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/mocks/{id}': {
      get: {
        tags: ['Mocks'],
        summary: 'Get mock endpoint details',
        description: 'Retrieve detailed information about a mock endpoint including samples and active script.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
            description: 'Mock endpoint ID',
          },
        ],
        responses: {
          200: {
            description: 'Mock endpoint details',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MockEndpointDetail',
                },
              },
            },
          },
          404: {
            description: 'Mock endpoint not found',
          },
        },
      },
      put: {
        tags: ['Mocks'],
        summary: 'Update mock endpoint',
        description: 'Update mock endpoint configuration.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
            description: 'Mock endpoint ID',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  pathPattern: {
                    type: 'string',
                  },
                  proxyUrl: {
                    type: 'string',
                    format: 'uri',
                  },
                  promptExtra: {
                    type: 'string',
                  },
                  status: {
                    type: 'string',
                    enum: ['draft', 'ready', 'active', 'deactivated'],
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Mock endpoint updated successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MockEndpoint',
                },
              },
            },
          },
          404: {
            description: 'Mock endpoint not found',
          },
        },
      },
      delete: {
        tags: ['Mocks'],
        summary: 'Delete mock endpoint',
        description: 'Delete a mock endpoint. CASCADE deletes samples and scripts; SET NULL on traffic logs.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
            description: 'Mock endpoint ID',
          },
        ],
        responses: {
          204: {
            description: 'Mock endpoint deleted successfully',
          },
          404: {
            description: 'Mock endpoint not found',
          },
        },
      },
    },
    '/api/mocks/{id}/samples': {
      post: {
        tags: ['Samples'],
        summary: 'Add a sample request/response pair',
        description: 'Add a sample to help the AI learn the API pattern.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
            description: 'Mock endpoint ID',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SamplePair',
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Sample created successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SamplePair',
                },
              },
            },
          },
          404: {
            description: 'Mock endpoint not found',
          },
        },
      },
    },
    '/api/mocks/{id}/samples/{sampleId}': {
      delete: {
        tags: ['Samples'],
        summary: 'Delete a sample',
        description: 'Remove a sample request/response pair.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
            description: 'Mock endpoint ID',
          },
          {
            name: 'sampleId',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
            description: 'Sample ID',
          },
        ],
        responses: {
          204: {
            description: 'Sample deleted successfully',
          },
          404: {
            description: 'Sample not found',
          },
        },
      },
    },
    '/api/mocks/{id}/generate': {
      post: {
        tags: ['Mocks'],
        summary: 'Generate a mock script via AI',
        description:
          'Generate a mock script using AI. Requires minimum 5 samples. Uses existing samples and promptExtra.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
            description: 'Mock endpoint ID',
          },
        ],
        responses: {
          200: {
            description: 'Script generated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    version: {
                      type: 'number',
                      example: 1,
                    },
                    code: {
                      type: 'string',
                      example:
                        'const { id } = req.params;\nreturn { status: 200, body: { id: parseInt(id) } };',
                    },
                    aiModel: {
                      type: 'string',
                      example: 'gpt-4o',
                    },
                  },
                },
              },
            },
          },
          503: {
            description: 'Insufficient samples',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'string',
                      example: 'Need 5+ samples',
                    },
                    current: {
                      type: 'number',
                      example: 2,
                    },
                  },
                },
              },
            },
          },
          502: {
            description: 'AI generation failed',
          },
        },
      },
    },
    '/api/mocks/{id}/regenerate': {
      post: {
        tags: ['Mocks'],
        summary: 'Regenerate mock script',
        description:
          'Regenerate an improved version of the active script. Includes previous script as context.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
            description: 'Mock endpoint ID',
          },
        ],
        responses: {
          200: {
            description: 'Script regenerated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    version: {
                      type: 'number',
                      example: 2,
                    },
                    code: {
                      type: 'string',
                    },
                    aiModel: {
                      type: 'string',
                      example: 'gpt-4o',
                    },
                  },
                },
              },
            },
          },
          502: {
            description: 'AI regeneration failed',
          },
        },
      },
    },
    '/api/mocks/{id}/try': {
      post: {
        tags: ['Scripts'],
        summary: 'Test a mock script',
        description:
          'Test the active mock script without persistence. Useful for validating scripts before deployment.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
            description: 'Mock endpoint ID',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  method: {
                    type: 'string',
                    example: 'GET',
                  },
                  path: {
                    type: 'string',
                    example: '/test/42',
                  },
                  params: {
                    type: 'object',
                    additionalProperties: true,
                  },
                  headers: {
                    type: 'object',
                    additionalProperties: {
                      type: 'string',
                    },
                  },
                  body: {},
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Script execution result',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MockResponse',
                },
              },
            },
          },
          500: {
            description: 'Script execution error',
          },
        },
      },
    },
    '/api/mocks/{id}/traffic': {
      get: {
        tags: ['Traffic'],
        summary: 'View traffic logs',
        description: 'Retrieve traffic logs for a mock endpoint with pagination.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
            description: 'Mock endpoint ID',
          },
          {
            name: 'page',
            in: 'query',
            required: false,
            schema: {
              type: 'number',
              default: 1,
            },
            description: 'Page number',
          },
          {
            name: 'pageSize',
            in: 'query',
            required: false,
            schema: {
              type: 'number',
              default: 50,
            },
            description: 'Items per page',
          },
          {
            name: 'source',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['mock', 'proxy', 'fallback'],
            },
            description: 'Filter by source',
          },
        ],
        responses: {
          200: {
            description: 'Paginated traffic logs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    logs: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/TrafficLog',
                      },
                    },
                    total: {
                      type: 'number',
                      example: 150,
                    },
                    page: {
                      type: 'number',
                      example: 1,
                    },
                    pageSize: {
                      type: 'number',
                      example: 50,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/mocks/{id}/scripts': {
      get: {
        tags: ['Scripts'],
        summary: 'List script versions',
        description: 'List all script versions for a mock endpoint.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
            description: 'Mock endpoint ID',
          },
        ],
        responses: {
          200: {
            description: 'List of script versions',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/MockScript',
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/samples/{id}': {
      get: {
        tags: ['Samples'],
        summary: 'Get sample details',
        description: 'Retrieve details of a specific sample request/response pair.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              format: 'uuid',
            },
            description: 'Sample ID',
          },
        ],
        responses: {
          200: {
            description: 'Sample details',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SamplePair',
                },
              },
            },
          },
          404: {
            description: 'Sample not found',
          },
        },
      },
    },
    '/api/traffic': {
      get: {
        tags: ['Traffic'],
        summary: 'List all traffic logs',
        description:
          'Retrieve all traffic logs scoped to the current tenant with pagination.',
        parameters: [
          {
            name: 'page',
            in: 'query',
            required: false,
            schema: {
              type: 'number',
              default: 1,
            },
            description: 'Page number',
          },
          {
            name: 'pageSize',
            in: 'query',
            required: false,
            schema: {
              type: 'number',
              default: 50,
            },
            description: 'Items per page',
          },
        ],
        responses: {
          200: {
            description: 'Paginated traffic logs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    logs: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/TrafficLog',
                      },
                    },
                    total: {
                      type: 'number',
                    },
                    page: {
                      type: 'number',
                    },
                    pageSize: {
                      type: 'number',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/scripts/test': {
      post: {
        tags: ['Scripts'],
        summary: 'Test a script with custom code',
        description:
          'Test arbitrary script code without saving it. Useful for iterative development.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code', 'request'],
                properties: {
                  code: {
                    type: 'string',
                    description: 'JavaScript code to execute',
                  },
                  request: {
                    type: 'object',
                    properties: {
                      method: {
                        type: 'string',
                      },
                      path: {
                        type: 'string',
                      },
                      params: {
                        type: 'object',
                      },
                      headers: {
                        type: 'object',
                      },
                      body: {},
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Script execution result',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MockResponse',
                },
              },
            },
          },
          500: {
            description: 'Script execution error',
          },
        },
      },
    },
    '/_it/mock/{*path}': {
      get: {
        tags: ['Runtime'],
        summary: 'Mock endpoint (all methods)',
        description:
          'Serve mock requests using AI-generated scripts. Finds longest matching MockEndpoint and executes active MockScript.',
        parameters: [
          {
            name: 'path',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Request path',
          },
        ],
        responses: {
          200: {
            description: 'Mock response from script execution',
          },
          404: {
            description: 'No matching mock endpoint',
          },
          503: {
            description: 'No active script — need 5+ samples',
          },
        },
      },
    },
    '/_it/auto/{*path}': {
      get: {
        tags: ['Runtime'],
        summary: 'Auto endpoint (proxy → fallback)',
        description:
          'Forward to real API first, fall back to mock if upstream is down.',
        parameters: [
          {
            name: 'path',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Request path',
          },
        ],
        responses: {
          200: {
            description: 'Response from proxy or mock fallback',
          },
          502: {
            description: 'Mock unavailable when fallback needed',
          },
        },
      },
    },
  },
  components: {
    schemas: {
      MockEndpoint: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          pathPattern: {
            type: 'string',
            example: '/test/:id',
          },
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
          },
          proxyUrl: {
            type: 'string',
            format: 'uri',
            nullable: true,
          },
          status: {
            type: 'string',
            enum: ['draft', 'ready', 'active', 'deactivated'],
          },
          promptExtra: {
            type: 'string',
            nullable: true,
          },
          priority: {
            type: 'number',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      MockEndpointSummary: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          pathPattern: {
            type: 'string',
          },
          method: {
            type: 'string',
          },
          status: {
            type: 'string',
          },
          sampleCount: {
            type: 'number',
          },
          hasActiveScript: {
            type: 'boolean',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      MockEndpointDetail: {
        allOf: [
          {
            $ref: '#/components/schemas/MockEndpoint',
          },
          {
            type: 'object',
            properties: {
              samples: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/SamplePair',
                },
              },
              activeScript: {
                $ref: '#/components/schemas/MockScriptSummary',
              },
            },
          },
        ],
      },
      SamplePair: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          source: {
            type: 'string',
            enum: ['manual', 'proxy', 'import'],
          },
          request: {
            type: 'object',
            properties: {
              method: {
                type: 'string',
              },
              path: {
                type: 'string',
              },
              params: {
                type: 'object',
              },
              headers: {
                type: 'object',
              },
              body: {},
            },
          },
          response: {
            type: 'object',
            properties: {
              status: {
                type: 'number',
              },
              headers: {
                type: 'object',
              },
              body: {},
              latency: {
                type: 'number',
              },
            },
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      MockScript: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          version: {
            type: 'number',
          },
          aiModel: {
            type: 'string',
          },
          isActive: {
            type: 'boolean',
          },
          validationError: {
            type: 'string',
            nullable: true,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      MockScriptSummary: {
        type: 'object',
        properties: {
          version: {
            type: 'number',
          },
          aiModel: {
            type: 'string',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      MockResponse: {
        type: 'object',
        properties: {
          status: {
            type: 'number',
            example: 200,
          },
          headers: {
            type: 'object',
            additionalProperties: {
              type: 'string',
            },
          },
          body: {},
        },
      },
      TrafficLog: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          route: {
            type: 'string',
          },
          method: {
            type: 'string',
          },
          path: {
            type: 'string',
          },
          request: {
            type: 'object',
          },
          response: {
            type: 'object',
            properties: {
              status: {
                type: 'number',
              },
              body: {},
              latency: {
                type: 'number',
              },
            },
          },
          source: {
            type: 'string',
            enum: ['mock', 'proxy', 'fallback'],
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
          },
          message: {
            type: 'string',
            nullable: true,
          },
        },
      },
    },
  },
};
