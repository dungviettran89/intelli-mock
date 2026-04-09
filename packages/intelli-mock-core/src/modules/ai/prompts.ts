import { SampleRequest, SampleResponse } from '../../entities/sample-pair.entity';

export interface SamplePairForPrompt {
  request: SampleRequest;
  response: SampleResponse;
}

/**
 * System prompt that defines the AI's role and output format.
 */
export const SYSTEM_PROMPT = `You are an expert JavaScript developer specializing in creating mock API handlers for Express.js applications.

Your task is to generate a JavaScript function that handles HTTP requests and returns appropriate mock responses.

## Available Context

The handler function receives two arguments:
- \`req\`: Express request object with:
  - \`req.method\`: HTTP method (GET, POST, etc.)
  - \`req.params\`: Route parameters (e.g., { id: "123" })
  - \`req.query\`: Query string parameters
  - \`req.headers\`: Request headers
  - \`req.body\`: Request body

- \`ctx\`: Context object with utilities:
  - \`ctx.utils.delay(ms)\`: Pause execution for \`ms\` milliseconds
  - \`ctx.utils.random(min, max)\`: Generate random number between min and max
  - \`ctx.utils.pick(arr)\`: Randomly select an element from array
  - \`ctx.utils.oneOf(...options)\`: Return one of the provided options
  - \`ctx.tenant\`: Current tenant information
  - \`ctx.params\`: Route parameters (same as req.params)

## Output Requirements

1. Export an async function using \`module.exports = async (req, ctx) => { ... }\`
2. Return an object with:
   - \`status\`: HTTP status code (number)
   - \`headers\`: Optional response headers (object)
   - \`body\`: Response body (any JSON-serializable value)
3. Use the sample request/response pairs to understand the API patterns
4. Make the handler realistic and handle common scenarios
5. Use the provided utilities where appropriate for variability

## Code Style

- Use modern JavaScript (async/await, destructuring, arrow functions)
- Include basic error handling
- Keep it concise but functional
- Do NOT include markdown formatting, code fences, or explanations — return ONLY the JavaScript code`;

/**
 * Creates a user prompt from sample request/response pairs.
 */
export function createUserPrompt(
  samples: SamplePairForPrompt[],
  pathPattern: string,
  method: string,
  promptExtra?: string,
): string {
  const samplesFormatted = samples
    .map(
      (sample, index) => `
### Sample ${index + 1}

**Request:**
- Method: ${sample.request.method}
- Path: ${sample.request.path}
${sample.request.params ? `- Params: ${JSON.stringify(sample.request.params)}` : ''}
${sample.request.query ? `- Query: ${JSON.stringify(sample.request.query)}` : ''}
${sample.request.headers ? `- Headers: ${JSON.stringify(sample.request.headers)}` : ''}
${sample.request.body !== undefined ? `- Body: ${JSON.stringify(sample.request.body)}` : ''}

**Response:**
- Status: ${sample.response.status}
- Body: ${JSON.stringify(sample.response.body, null, 2)}
${sample.response.headers ? `- Headers: ${JSON.stringify(sample.response.headers)}` : ''}
`,
    )
    .join('\n');

  const extra = promptExtra ? `\n\n## Additional Requirements\n\n${promptExtra}` : '';

  return `Generate a mock Express-style handler for the following API endpoint:

**Endpoint:**
- Path Pattern: ${pathPattern}
- Method: ${method}

## Sample Request/Response Pairs

${samplesFormatted}
${extra}

Please generate the JavaScript handler code based on these patterns.`;
}

/**
 * Creates a minimal prompt for testing purposes.
 */
export function createTestPrompt(): string {
  return 'Generate a simple mock handler that returns { status: 200, body: { ok: true } }';
}
