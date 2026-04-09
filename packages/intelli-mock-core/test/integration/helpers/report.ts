export interface StepResult {
  description: string;
  passed: boolean;
  duration: number;
  details?: string;
}

export interface ScenarioResult {
  name: string;
  passed: boolean;
  steps: StepResult[];
  totalDuration: number;
}

export interface TestReport {
  date: string;
  ollamaStatus: string;
  externalApiStatus: string;
  serverPort: number | null;
  scenarios: ScenarioResult[];
  totalDuration: number;
}

/**
 * Creates a new report object.
 */
export function createReport(): TestReport {
  return {
    date: new Date().toISOString(),
    ollamaStatus: 'Not checked',
    externalApiStatus: 'Not checked',
    serverPort: null,
    scenarios: [],
    totalDuration: 0,
  };
}

/**
 * Runs a single step and tracks timing + result.
 */
export async function runStep(
  description: string,
  fn: () => Promise<void>,
): Promise<StepResult> {
  const startTime = Date.now();
  try {
    await fn();
    const duration = Date.now() - startTime;
    return { description, passed: true, duration };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    return {
      description,
      passed: false,
      duration,
      details: error.message || String(error),
    };
  }
}

/**
 * Formats a step result as a human-readable string.
 */
export function formatStep(step: StepResult): string {
  const icon = step.passed ? '✅' : '❌';
  const time = step.passed ? ` (${step.duration}ms)` : ` (failed after ${step.duration}ms)`;
  const details = step.details ? `\n   → ${step.details}` : '';
  return `  ${icon} ${step.description}${time}${details}`;
}

/**
 * Formats a full scenario result.
 */
export function formatScenarioResult(scenario: ScenarioResult): string {
  const lines = [
    `───────────────────────────────────────────────────────────`,
    `Scenario: ${scenario.name}`,
    `───────────────────────────────────────────────────────────`,
    '',
    ...scenario.steps.map(formatStep),
    '',
    `Result: ${scenario.passed ? '✅ PASSED' : '❌ FAILED'} (${scenario.totalDuration}ms)`,
  ];
  return lines.join('\n');
}

/**
 * Prints the full test report.
 */
export function printReport(report: TestReport): void {
  const lines = [
    '',
    '═══════════════════════════════════════════════════════════',
    '  Intelli-Mock Integration Test Report',
    '═══════════════════════════════════════════════════════════',
    '',
    `Date: ${report.date}`,
    `Ollama: ${report.ollamaStatus}`,
    `JSONPlaceholder: ${report.externalApiStatus}`,
    report.serverPort ? `Intelli-Mock: ✅ Started on port ${report.serverPort}` : 'Intelli-Mock: ⚠️ Server not started',
    '',
    ...report.scenarios.map(formatScenarioResult),
    '',
    '───────────────────────────────────────────────────────────',
    'Summary',
    '───────────────────────────────────────────────────────────',
    '',
  ];

  const passed = report.scenarios.filter((s) => s.passed).length;
  const total = report.scenarios.length;

  lines.push(
    `${passed === total ? '✅' : '❌'} ${passed}/${total} scenarios passed`,
    `Total duration: ${report.totalDuration}ms`,
    '',
    '═══════════════════════════════════════════════════════════',
    '',
  );

  console.log(lines.join('\n'));
}
