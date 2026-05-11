import { marked } from 'marked';
import { getLocalizedNote } from './content';

/**
 * Converts localized note text into inline HTML.
 *
 * Paragraph wrappers are stripped because notes are inserted into existing
 * list/card text rather than standalone article blocks.
 *
 * @param note Raw localized note text.
 * @param sourceFile Source content file used for inline translation warnings.
 * @param translator Translation helper for inline tokens.
 * @returns Rendered HTML string.
 */
function renderNote(note: string, sourceFile: string, translator: any) {
  const renderedNote = translator.translateNoteText(note, sourceFile);

  return (marked.parse(renderedNote) as string).replace(/<\/?p>/g, '');
}

/**
 * Picks a short, stable note ID prefix from a content file name.
 *
 * @param sourceFile Content file path.
 * @returns Prefix used in note anchors.
 */
function getNotePrefix(sourceFile: string) {
  if (sourceFile.endsWith('weapons.json')) return 'w';
  if (sourceFile.endsWith('artifacts-sets.json')) return 'as';
  if (sourceFile.endsWith('artifacts-mainstats.json')) return 'am';
  if (sourceFile.endsWith('artifacts-substats.json')) return 'at';
  if (sourceFile.endsWith('talents.json')) return 't';

  return 'n';
}

/**
 * Extracts the build folder name from a content file path.
 *
 * Note IDs must be unique across all build cards on the same page, not just
 * inside one JSON file type.
 *
 * @param sourceFile Content file path.
 * @returns Sanitized build slug, or `shared` when none can be inferred.
 */
function getNoteScope(sourceFile: string) {
  const parts = sourceFile.replace(/\\/g, '/').split('/');
  const fileName = parts[parts.length - 1];
  const scope = parts[parts.length - 2];

  if (!fileName || !scope || scope === 'content') {
    return 'shared';
  }

  return scope.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
}

/**
 * Creates a unique note anchor ID inside one note section.
 *
 * @param sourceFile Content file path.
 * @param index Zero-based note index.
 * @returns Anchor ID.
 */
function createNoteId(sourceFile: string, index: number) {
  return `${getNotePrefix(sourceFile)}-${getNoteScope(sourceFile)}-${index + 1}`;
}

/**
 * Collects top-level section notes from a content JSON object.
 *
 * @param data Parsed content JSON.
 * @param sourceFile Source file path for note IDs and warnings.
 * @param lang Requested language code.
 * @param translator Translation helper for inline tokens.
 * @returns Rendered note HTML strings.
 */
export function collectSectionNotes(
  data: any,
  sourceFile: string,
  lang: string,
  translator: any,
) {
  if (!Array.isArray(data?.notes)) return [];

  // Section notes do not attach to an individual item, so no noteId is needed.
  return data.notes
    .map((note: any) => getLocalizedNote({ note }, lang))
    .filter(Boolean)
    .map((note: string) => renderNote(note, sourceFile, translator));
}

/**
 * Collects item-level notes and attaches note IDs back onto source items.
 *
 * @param groups Ranked groups containing `items` arrays.
 * @param formatter Converts an item into the label shown in Notes.
 * @param sourceFile Source file path for note IDs and warnings.
 * @param lang Requested language code.
 * @param translator Translation helper for inline tokens.
 * @returns Notes ready for rendering in the Notes component.
 */
export function collectNotes(
  groups: any[],
  formatter: (item: any) => string,
  sourceFile: string,
  lang: string,
  translator: any,
) {
  const notes: { id: string; name: string; note: string }[] = [];

  // Mutating noteId here lets recommendation cards link to their note entries.
  groups.forEach((group) => {
    group.items.forEach((item: any) => {
      const localizedNote = getLocalizedNote(item, lang);

      if (localizedNote) {
        const name = formatter(item);
        const noteId = createNoteId(sourceFile, notes.length);

        item.noteId = noteId;

        notes.push({
          id: noteId,
          name,
          note: renderNote(localizedNote, sourceFile, translator),
        });
      }
    });
  });

  return notes;
}

/**
 * Collects notes from stat rows, including grouped same-rank stat options.
 *
 * @param items Stat items or grouped stat alternatives.
 * @param formatter Converts an item into the label shown in Notes.
 * @param sourceFile Source file path for note IDs and warnings.
 * @param lang Requested language code.
 * @param translator Translation helper for inline tokens.
 * @returns Notes ready for rendering in the Notes component.
 */
export function collectStatNotes(
  items: any[],
  formatter: (item: any) => string,
  sourceFile: string,
  lang: string,
  translator: any,
) {
  const notes: { id: string; name: string; note: string }[] = [];

  items
    .flatMap((item) => item.items ?? [item])
    .forEach((item) => {
      const localizedNote = getLocalizedNote(item, lang);

      if (localizedNote) {
        const name = formatter(item);
        const noteId = createNoteId(sourceFile, notes.length);

        item.noteId = noteId;

        notes.push({
          id: noteId,
          name,
          note: renderNote(localizedNote, sourceFile, translator),
        });
      }
    });

  return notes;
}
