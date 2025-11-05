/**
 * PAN Autoload - TypeScript Definitions
 *
 * Progressive component loader for Web Components
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface PanAutoloadConfig {
  /**
   * Full CDN URL or base URL for loading components
   * Example: 'https://unpkg.com/pan@latest/'
   */
  baseUrl?: string | null;

  /**
   * Relative path from baseUrl or import.meta.url
   * @default './'
   */
  componentsPath?: string;

  /**
   * File extension for component modules
   * @default '.mjs' (use '.js' for npm packages)
   */
  extension?: string;

  /**
   * Intersection observer root margin in pixels
   * @default 600
   */
  rootMargin?: number;

  /**
   * Resolved absolute URL for component loading (computed)
   * @readonly
   */
  resolvedComponentsPath?: string;
}

// ============================================================================
// API
// ============================================================================

/**
 * Attempt to load a component module for the given element
 */
export function maybeLoadFor(el: HTMLElement): Promise<void>;

/**
 * Observe a tree for undefined custom elements and load them
 */
export function observeTree(root?: Document | HTMLElement): void;

// ============================================================================
// Exports
// ============================================================================

export interface PanAutoload {
  config: Required<PanAutoloadConfig>;
  observeTree: typeof observeTree;
  maybeLoadFor: typeof maybeLoadFor;
}

export const panAutoload: PanAutoload;
export default panAutoload;

// ============================================================================
// Global Augmentation
// ============================================================================

declare global {
  interface Window {
    panAutoload?: Partial<PanAutoloadConfig> & {
      config?: Required<PanAutoloadConfig>;
      observeTree?: typeof observeTree;
      maybeLoadFor?: typeof maybeLoadFor;
    };
  }
}
