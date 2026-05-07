/**
 * Apply a single suggested edit to the steps-template.ts source file.
 *
 * The suggestion identifies a step by id, a field, and the exact current
 * text. We find the step's block in the source, search within that block
 * for the current text, and replace it with the proposed text. If the
 * current text isn't found verbatim or matches multiple times we throw —
 * better to fail loudly than apply a corrupt edit.
 */
export function applyEdit(
  fileContent: string,
  stepId: string,
  currentValue: string,
  proposedValue: string,
): string {
  const marker = `id: "${stepId}"`;
  const start = fileContent.indexOf(marker);
  if (start === -1) throw new Error(`Step id "${stepId}" not found`);

  // Walk forward from the marker until we hit the next template or end of array.
  const afterMarker = start + marker.length;
  const nextStep = fileContent.indexOf("\n  {\n    id:", afterMarker);
  const endOfArray = fileContent.indexOf("\n];", afterMarker);
  const candidates = [nextStep, endOfArray].filter(i => i !== -1);
  if (candidates.length === 0) throw new Error("Could not locate end of template block");
  const end = Math.min(...candidates);

  const block = fileContent.slice(start, end);
  if (!block.includes(currentValue)) {
    throw new Error(
      `Current value not found verbatim in step "${stepId}". The suggestion may be stale or the source has changed.`,
    );
  }
  if (block.indexOf(currentValue) !== block.lastIndexOf(currentValue)) {
    throw new Error(
      `Current value matches multiple places in step "${stepId}". Cannot apply safely; reject and regenerate.`,
    );
  }

  // Escape the proposed value so it stays valid inside the surrounding
  // double-quoted TypeScript string literal. JSON.stringify gives us
  // exactly the right escapes ("\\", "\"", "\n", control chars); strip the
  // outer quotes so we splice the contents into the existing string.
  const escapedProposed = JSON.stringify(proposedValue).slice(1, -1);
  const newBlock = block.replace(currentValue, escapedProposed);
  return fileContent.slice(0, start) + newBlock + fileContent.slice(end);
}
