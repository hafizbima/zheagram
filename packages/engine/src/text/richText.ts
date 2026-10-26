export interface TextSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

export interface FormattedLine {
  raw: string;
  isBullet: boolean;
  isNumbered: boolean;
  numberPrefix?: string;
  indent: number;
  spans: TextSpan[];
}

/**
 * Parses markdown-style inline text and list markers into structured lines and styled spans.
 * Supports:
 * - Bullet list lines (`- `, `* `, `• `)
 * - Numbered list lines (`1. `, `2. `, etc.)
 * - Inline **bold**
 * - Inline *italic*
 * - Inline <u>underline</u> or __underline__
 * - Inline ~~strikethrough~~
 */
export function parseRichText(text: string): FormattedLine[] {
  if (!text) {
    return [
      {
        raw: '',
        isBullet: false,
        isNumbered: false,
        indent: 0,
        spans: [{ text: '' }],
      },
    ];
  }

  const rawLines = text.split('\n');

  return rawLines.map((raw) => {
    // Determine leading whitespace indent
    const indentMatch = raw.match(/^(\s*)/);
    const leadingSpaces = indentMatch ? indentMatch[1].length : 0;
    const indent = Math.floor(leadingSpaces / 2);
    const trimmed = raw.trimStart();

    let isBullet = false;
    let isNumbered = false;
    let numberPrefix: string | undefined;
    let content = trimmed;

    // Check for bullet marker
    if (/^[-*•]\s+/.test(trimmed)) {
      isBullet = true;
      content = trimmed.replace(/^[-*•]\s+/, '');
    } else {
      // Check for numbered list marker (e.g. "1. ", "12. ")
      const numMatch = trimmed.match(/^(\d+\.)\s+/);
      if (numMatch) {
        isNumbered = true;
        numberPrefix = numMatch[1];
        content = trimmed.substring(numMatch[0].length);
      }
    }

    const spans = parseInlineSpans(content);

    return {
      raw,
      isBullet,
      isNumbered,
      numberPrefix,
      indent,
      spans,
    };
  });
}

/**
 * Parses inline formatting tags into an array of TextSpans.
 */
export function parseInlineSpans(text: string): TextSpan[] {
  if (!text) return [{ text: '' }];

  // Tokenize using regex matching bold (**), italic (*), underline (<u>..</u> or __), strike (~~)
  const tokenRegex =
    /(\*\*(.+?)\*\*)|(\*([^*]+?)\*)|(<u>([\s\S]+?)<\/u>)|(__([^_]+?)__)|(~~([\s\S]+?)~~)/g;

  const spans: TextSpan[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      spans.push({ text: text.substring(lastIndex, match.index) });
    }

    if (match[1]) {
      // **bold**
      spans.push({ text: match[2], bold: true });
    } else if (match[3]) {
      // *italic*
      spans.push({ text: match[4], italic: true });
    } else if (match[5]) {
      // <u>underline</u>
      spans.push({ text: match[6], underline: true });
    } else if (match[7]) {
      // __underline__
      spans.push({ text: match[8], underline: true });
    } else if (match[9]) {
      // ~~strike~~
      spans.push({ text: match[10], strikethrough: true });
    }

    lastIndex = tokenRegex.lastIndex;
  }

  // Trailing text
  if (lastIndex < text.length) {
    spans.push({ text: text.substring(lastIndex) });
  }

  return spans.length > 0 ? spans : [{ text: '' }];
}

/**
 * Toggles an inline format (**bold**, *italic*, <u>underline</u>, ~~strikethrough~~)
 * around the current selection within a textarea.
 */
export function toggleInlineFormat(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  format: 'bold' | 'italic' | 'underline' | 'strikethrough'
): { newText: string; newStart: number; newEnd: number } {
  let prefix = '';
  let suffix = '';

  switch (format) {
    case 'bold':
      prefix = '**';
      suffix = '**';
      break;
    case 'italic':
      prefix = '*';
      suffix = '*';
      break;
    case 'underline':
      prefix = '<u>';
      suffix = '</u>';
      break;
    case 'strikethrough':
      prefix = '~~';
      suffix = '~~';
      break;
  }

  const selectedText = text.substring(selectionStart, selectionEnd);

  // Check if current selection is already wrapped with this format
  if (
    selectedText.startsWith(prefix) &&
    selectedText.endsWith(suffix) &&
    selectedText.length >= prefix.length + suffix.length
  ) {
    // Unwrap selection
    const unwrapped = selectedText.slice(prefix.length, -suffix.length);
    const newText =
      text.substring(0, selectionStart) + unwrapped + text.substring(selectionEnd);
    return {
      newText,
      newStart: selectionStart,
      newEnd: selectionStart + unwrapped.length,
    };
  }

  // Check if the characters directly outside the selection are already prefix and suffix
  const before = text.substring(selectionStart - prefix.length, selectionStart);
  const after = text.substring(selectionEnd, selectionEnd + suffix.length);
  if (before === prefix && after === suffix) {
    // Unwrap from outside
    const newText =
      text.substring(0, selectionStart - prefix.length) +
      selectedText +
      text.substring(selectionEnd + suffix.length);
    return {
      newText,
      newStart: selectionStart - prefix.length,
      newEnd: selectionStart - prefix.length + selectedText.length,
    };
  }

  // Otherwise, wrap selection
  const wrapped = prefix + selectedText + suffix;
  const newText =
    text.substring(0, selectionStart) + wrapped + text.substring(selectionEnd);

  if (selectionStart === selectionEnd) {
    // Collapsed cursor: place cursor inside tags
    return {
      newText,
      newStart: selectionStart + prefix.length,
      newEnd: selectionStart + prefix.length,
    };
  }

  return {
    newText,
    newStart: selectionStart,
    newEnd: selectionStart + wrapped.length,
  };
}

/**
 * Toggles bullet or numbered list formatting across lines in selection.
 */
export function toggleListFormat(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  type: 'bullet' | 'numbered'
): { newText: string; newStart: number; newEnd: number } {
  const lines = text.split('\n');
  const lineStarts: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      lineStarts.push(i + 1);
    }
  }

  const targetIndices: number[] = [];
  for (let idx = 0; idx < lines.length; idx++) {
    const start = lineStarts[idx];
    const end = start + lines[idx].length;
    if (end >= selectionStart && start <= (selectionEnd === selectionStart ? selectionStart : selectionEnd)) {
      targetIndices.push(idx);
    }
  }

  if (targetIndices.length === 0) {
    targetIndices.push(0);
  }

  // Check if all targeted lines are already list items of requested type
  const allAlreadyOfType = targetIndices.every((idx) => {
    const line = lines[idx].trimStart();
    if (type === 'bullet') {
      return /^[-*•]\s+/.test(line);
    } else {
      return /^\d+\.\s+/.test(line);
    }
  });

  const updatedLines = [...lines];

  if (allAlreadyOfType) {
    // Strip list prefix from all target lines
    for (const idx of targetIndices) {
      if (type === 'bullet') {
        updatedLines[idx] = updatedLines[idx].replace(/^(\s*)[-*•]\s+/, '$1');
      } else {
        updatedLines[idx] = updatedLines[idx].replace(/^(\s*)\d+\.\s+/, '$1');
      }
    }
  } else {
    // Add prefix to each target line
    let count = 1;
    for (const idx of targetIndices) {
      const line = updatedLines[idx];
      const cleaned = line.replace(/^(\s*)([-*•]|\d+\.)\s+/, '$1');
      const leadingSpaces = cleaned.match(/^(\s*)/)?.[1] || '';
      const core = cleaned.slice(leadingSpaces.length);

      if (type === 'bullet') {
        updatedLines[idx] = `${leadingSpaces}- ${core}`;
      } else {
        updatedLines[idx] = `${leadingSpaces}${count}. ${core}`;
        count++;
      }
    }
  }

  const newText = updatedLines.join('\n');
  return {
    newText,
    newStart: selectionStart,
    newEnd: Math.min(newText.length, selectionEnd + (newText.length - text.length)),
  };
}

/**
 * Handles pressing Enter inside a list:
 * - If current line is an empty list item ("- " or "1. "), pressing Enter removes the list marker and exits the list.
 * - If current line has content after the list marker, pressing Enter continues the list on the next line.
 */
export function handleListAutoContinue(
  text: string,
  selectionStart: number
): { handled: boolean; newText: string; newCursor: number } {
  const lineStart = text.lastIndexOf('\n', selectionStart - 1) + 1;
  const lineEnd = text.indexOf('\n', selectionStart);
  const currentLineEnd = lineEnd === -1 ? text.length : lineEnd;
  const currentLine = text.substring(lineStart, currentLineEnd);
  const textBeforeCursorInLine = text.substring(lineStart, selectionStart);

  // Check if bullet line
  const bulletMatch = textBeforeCursorInLine.match(/^(\s*)[-*•]\s*(.*)$/);
  if (bulletMatch) {
    const leading = bulletMatch[1];
    const rest = bulletMatch[2].trim();

    if (rest === '' && (currentLine.trim() === '-' || currentLine.trim() === '*' || currentLine.trim() === '•' || currentLine.trim() === '')) {
      // Empty bullet -> remove bullet marker (exit list)
      const newText =
        text.substring(0, lineStart) + text.substring(currentLineEnd);
      return {
        handled: true,
        newText,
        newCursor: lineStart,
      };
    }

    // Continue bullet list
    const continuation = `\n${leading}- `;
    const newText =
      text.substring(0, selectionStart) +
      continuation +
      text.substring(selectionStart);
    return {
      handled: true,
      newText,
      newCursor: selectionStart + continuation.length,
    };
  }

  // Check if numbered line
  const numMatch = textBeforeCursorInLine.match(/^(\s*)(\d+)\.\s*(.*)$/);
  if (numMatch) {
    const leading = numMatch[1];
    const currentNum = parseInt(numMatch[2], 10);
    const rest = numMatch[3].trim();

    if (rest === '' && currentLine.trim() === `${currentNum}.`) {
      // Empty numbered item -> remove marker (exit list)
      const newText =
        text.substring(0, lineStart) + text.substring(currentLineEnd);
      return {
        handled: true,
        newText,
        newCursor: lineStart,
      };
    }

    // Continue numbered list
    const continuation = `\n${leading}${currentNum + 1}. `;
    const newText =
      text.substring(0, selectionStart) +
      continuation +
      text.substring(selectionStart);
    return {
      handled: true,
      newText,
      newCursor: selectionStart + continuation.length,
    };
  }

  return { handled: false, newText: text, newCursor: selectionStart };
}
