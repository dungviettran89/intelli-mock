import { injectable } from 'tsyringe';
import { MockEndpoint } from '../../entities/mock-endpoint.entity';

export interface MatchResult {
  endpoint: MockEndpoint;
  params: Record<string, string>;
}

interface ScoredMatch {
  endpoint: MockEndpoint;
  score: number;
  params: Record<string, string>;
}

/**
 * RouteMatcher implements longest-match routing with wildcard support.
 *
 * Pattern syntax:
 *   - Exact: `/api/users` matches only `/api/users`
 *   - Param: `/api/users/:id` captures `:id` as a named parameter
 *   - Single wildcard: `/api/*` matches one segment (e.g. `/api/users`)
 *   - Multi wildcard: `/api/**` matches any path depth (e.g. `/api/users/42/posts`)
 *
 * Scoring (higher wins):
 *   - Exact segment: 10 points
 *   - Named param `:id`: 5 points
 *   - Single wildcard `*`: 2 points
 *   - Multi wildcard `**`: 1 point
 *
 * The highest score wins. Ties are broken by `priority` field on MockEndpoint.
 */
@injectable()
export class RouteMatcher {
  /**
   * Finds the best matching endpoint for a given method and path.
   * @param endpoints List of candidate endpoints (should be pre-filtered by tenant)
   * @param method HTTP method (e.g. 'GET', 'POST')
   * @param path Request path (e.g. '/api/users/42')
   * @returns MatchResult with endpoint and extracted params, or null if no match
   */
  match(endpoints: MockEndpoint[], method: string, path: string): MatchResult | null {
    // Normalize: strip trailing slash, ensure leading slash
    const normalizedPath = this.normalizePath(path);

    const scored: ScoredMatch[] = [];

    for (const endpoint of endpoints) {
      // Filter by method (ANY matches everything)
      if (endpoint.method !== method && endpoint.method !== 'ANY') {
        continue;
      }

      const params: Record<string, string> = {};
      const score = this.scorePattern(endpoint.pathPattern, normalizedPath, params);

      if (score !== null) {
        scored.push({ endpoint, score, params });
      }
    }

    if (scored.length === 0) {
      return null;
    }

    // Sort by score descending, then by priority descending as tiebreaker
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.endpoint.priority - a.endpoint.priority;
    });

    const winner = scored[0];
    return { endpoint: winner.endpoint, params: winner.params };
  }

  /**
   * Scores a pattern against a path. Returns null if no match, or a numeric score.
   * Populates the params object with extracted named parameters.
   */
  private scorePattern(pattern: string, path: string, params: Record<string, string>): number | null {
    const normalizedPattern = this.normalizePath(pattern);
    const patternSegments = normalizedPattern.split('/').filter(Boolean);
    const pathSegments = path.split('/').filter(Boolean);

    const result = this.matchSegments(patternSegments, 0, pathSegments, 0);
    if (!result) return null;

    // Copy extracted params
    Object.assign(params, result.params);
    return result.score;
  }

  /**
   * Recursively match pattern segments against path segments.
   * Returns { score, params } on match, null otherwise.
   */
  private matchSegments(
    patternSegments: string[],
    pIdx: number,
    pathSegments: string[],
    pathIdx: number,
  ): { score: number; params: Record<string, string> } | null {
    // Both fully consumed — match
    if (pIdx >= patternSegments.length && pathIdx >= pathSegments.length) {
      return { score: 0, params: {} };
    }

    // Pattern consumed but path remains — no match
    if (pIdx >= patternSegments.length) {
      return null;
    }

    const segment = patternSegments[pIdx];

    // Multi wildcard: try matching remaining pattern at every possible path position
    if (segment === '**') {
      const afterWildcard = pIdx + 1;

      // Try skipping 0, 1, 2, ... path segments
      for (let skip = 0; skip <= pathSegments.length - pathIdx; skip++) {
        const newScore = this.matchSegments(
          patternSegments,
          afterWildcard,
          pathSegments,
          pathIdx + skip,
        );
        if (newScore) {
          return { score: 1 + newScore.score, params: newScore.params };
        }
      }
      return null;
    }

    // Path consumed but pattern remains — no match
    if (pathIdx >= pathSegments.length) {
      return null;
    }

    const pathSegment = pathSegments[pathIdx];

    // Exact segment match
    if (segment === pathSegment) {
      const rest = this.matchSegments(patternSegments, pIdx + 1, pathSegments, pathIdx + 1);
      if (rest) return { score: 10 + rest.score, params: rest.params };
      return null;
    }

    // Named param: :paramName
    if (segment.startsWith(':')) {
      const paramName = segment.slice(1);
      if (paramName.length === 0) return null;
      const rest = this.matchSegments(patternSegments, pIdx + 1, pathSegments, pathIdx + 1);
      if (rest) {
        rest.params[paramName] = pathSegment;
        return { score: 5 + rest.score, params: rest.params };
      }
      return null;
    }

    // Single wildcard: * matches exactly one segment
    if (segment === '*') {
      const rest = this.matchSegments(patternSegments, pIdx + 1, pathSegments, pathIdx + 1);
      if (rest) return { score: 2 + rest.score, params: rest.params };
      return null;
    }

    // No match
    return null;
  }

  /**
   * Normalizes a path by stripping trailing slashes and ensuring a leading slash.
   */
  private normalizePath(path: string): string {
    let normalized = path.replace(/\/+$/, ''); // Strip trailing slashes
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    return normalized;
  }
}
