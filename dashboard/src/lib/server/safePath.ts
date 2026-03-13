import 'server-only';
import path from 'node:path';

/**
 * Resolve a filename within a base directory, preventing path traversal.
 * Returns null if the resolved path escapes the base directory.
 */
export function safePath(baseDir: string, filename: string): string | null {
  // Strip any directory components - only allow bare filenames
  const clean = path.basename(filename);
  if (!clean || clean === '.' || clean === '..') return null;
  
  const resolved = path.resolve(baseDir, clean);
  
  // Verify the resolved path is still inside the base directory
  if (!resolved.startsWith(path.resolve(baseDir) + path.sep) && resolved !== path.resolve(baseDir)) {
    return null;
  }
  
  return resolved;
}
