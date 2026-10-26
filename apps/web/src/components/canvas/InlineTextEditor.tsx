import React, { useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react';
import { BoardObject, TextStyle, ViewportTransform, ShapeObject, ShapeKind } from '@diagrammer/shared';
import {
  worldToScreen,
  toggleInlineFormat,
  toggleListFormat,
  handleListAutoContinue,
} from '@diagrammer/engine';
import { STICKY_COLOR_MAP } from '../../stores/useCanvasStore';
import { FloatingTextToolbar } from './FloatingTextToolbar';

interface InlineTextEditorProps {
  object: BoardObject & {
    x: number;
    y: number;
    width: number;
    height: number;
    text?: string;
    rotation?: number;
    textStyle?: TextStyle;
  };
  viewport: ViewportTransform;
  onFinish: (newText: string) => void;
  onChangeText?: (newText: string) => void;
  onChangeStyle?: (style: Partial<TextStyle>) => void;
}

export const InlineTextEditor: React.FC<InlineTextEditorProps> = ({
  object,
  viewport,
  onFinish,
  onChangeText,
  onChangeStyle,
}) => {
  const [text, setText] = useState<string>(object.text || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textValueRef = useRef<string>(object.text || '');
  const hasCommittedRef = useRef<boolean>(false);

  const textStyle: TextStyle = useMemo(
    () => ('textStyle' in object && object.textStyle ? object.textStyle : {}),
    [object]
  );

  const [activeFormats, setActiveFormats] = useState<{
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    bullet?: boolean;
    numbered?: boolean;
  }>({});

  const commit = (finalText?: string) => {
    if (hasCommittedRef.current) return;
    hasCommittedRef.current = true;
    const textToSave = finalText !== undefined ? finalText : textValueRef.current;
    onFinish(textToSave);
  };

  useEffect(() => {
    textValueRef.current = object.text || '';
    setText(object.text || '');
    hasCommittedRef.current = false;

    // Focus immediately and select text
    const timer = setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.select();
        updateActiveFormats();
      }
    }, 30);

    return () => {
      clearTimeout(timer);
    };
  }, [object.id]);

  const updateActiveFormats = () => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const currentVal = el.value;
    const selected = currentVal.substring(start, end);

    // Detect if selection or surrounding has formats
    const isBold =
      textStyle.fontWeight === 'bold' ||
      (selected.startsWith('**') && selected.endsWith('**') && selected.length >= 4) ||
      (currentVal.substring(start - 2, start) === '**' &&
        currentVal.substring(end, end + 2) === '**');

    const isItalic =
      textStyle.fontStyle === 'italic' ||
      (selected.startsWith('*') && selected.endsWith('*') && selected.length >= 2) ||
      (currentVal.substring(start - 1, start) === '*' &&
        currentVal.substring(end, end + 1) === '*');

    const isUnderline =
      (selected.startsWith('<u>') && selected.endsWith('</u>') && selected.length >= 7) ||
      (currentVal.substring(start - 3, start) === '<u>' &&
        currentVal.substring(end, end + 4) === '</u>');

    const isStrike =
      (selected.startsWith('~~') && selected.endsWith('~~') && selected.length >= 4) ||
      (currentVal.substring(start - 2, start) === '~~' &&
        currentVal.substring(end, end + 2) === '~~');

    // Detect list in line
    const lineStart = currentVal.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = currentVal.indexOf('\n', start);
    const line = currentVal.substring(lineStart, lineEnd === -1 ? currentVal.length : lineEnd);
    const isBullet = /^(\s*)[-*•]\s+/.test(line);
    const isNumbered = /^(\s*)\d+\.\s+/.test(line);

    setActiveFormats({
      bold: isBold,
      italic: isItalic,
      underline: isUnderline,
      strikethrough: isStrike,
      bullet: isBullet,
      numbered: isNumbered,
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    textValueRef.current = val;
    setText(val);
    onChangeText?.(val);
    updateActiveFormats();
  };

  const handleBlur = (e: React.FocusEvent) => {
    // If blur occurred because user clicked inside toolbar, ignore
    if (e.relatedTarget && (e.relatedTarget as HTMLElement).closest('.floating-text-toolbar')) {
      return;
    }
    commit();
  };

  const applyTextModification = (newVal: string, newStart: number, newEnd: number) => {
    textValueRef.current = newVal;
    setText(newVal);
    onChangeText?.(newVal);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newStart, newEnd);
        updateActiveFormats();
      }
    });
  };

  const handleToggleFormat = (format: 'bold' | 'italic' | 'underline' | 'strikethrough') => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const currentVal = el.value;

    const res = toggleInlineFormat(currentVal, start, end, format);
    applyTextModification(res.newText, res.newStart, res.newEnd);
  };

  const handleToggleList = (type: 'bullet' | 'numbered') => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const currentVal = el.value;

    const res = toggleListFormat(currentVal, start, end, type);
    applyTextModification(res.newText, res.newStart, res.newEnd);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();

    // Bold shortcut
    if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      handleToggleFormat('bold');
      return;
    }

    // Italic shortcut
    if ((e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I')) {
      e.preventDefault();
      handleToggleFormat('italic');
      return;
    }

    // Underline shortcut
    if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault();
      handleToggleFormat('underline');
      return;
    }

    // Strikethrough shortcut: Ctrl+Shift+S or Ctrl+Shift+X
    if (
      (e.ctrlKey || e.metaKey) &&
      e.shiftKey &&
      (e.key === 's' || e.key === 'S' || e.key === 'x' || e.key === 'X')
    ) {
      e.preventDefault();
      handleToggleFormat('strikethrough');
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      commit();
      return;
    }

    if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        commit();
        return;
      }

      // Check if we are inside a list line and auto-continue or exit list
      const el = textareaRef.current;
      if (el) {
        const auto = handleListAutoContinue(el.value, el.selectionStart);
        if (auto.handled) {
          e.preventDefault();
          applyTextModification(auto.newText, auto.newCursor, auto.newCursor);
          return;
        }
      }
      // Otherwise natural newline
    }

    // Tab key for list indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = textareaRef.current;
      if (!el) return;

      const start = el.selectionStart;
      const end = el.selectionEnd;
      const val = el.value;

      if (!e.shiftKey) {
        // Indent 2 spaces
        const newVal = val.substring(0, start) + '  ' + val.substring(end);
        applyTextModification(newVal, start + 2, start + 2);
      } else {
        // Outdent if previous 2 chars are spaces
        if (val.substring(start - 2, start) === '  ') {
          const newVal = val.substring(0, start - 2) + val.substring(end);
          applyTextModification(newVal, start - 2, start - 2);
        }
      }
    }
  };

  const isShape = object.type === 'shape';
  const shapeKind: ShapeKind | null = isShape && 'kind' in object ? (object as ShapeObject).kind : null;
  const isSticky = object.type === 'sticky';
  const isText = object.type === 'text';
  const isConnector = object.type === 'connector';

  // Compute safe inner width and max height ratios for non-rectangular and standard shapes
  let safeWidthRatio = 0.90;
  let safeHeightRatio = 0.90;

  if (shapeKind === 'diamond') {
    safeWidthRatio = 0.68;
    safeHeightRatio = 0.68;
  } else if (shapeKind === 'ellipse') {
    safeWidthRatio = 0.74;
    safeHeightRatio = 0.74;
  } else if (shapeKind === 'triangle') {
    safeWidthRatio = 0.65;
    safeHeightRatio = 0.60;
  } else if (shapeKind === 'cloud') {
    safeWidthRatio = 0.70;
    safeHeightRatio = 0.65;
  } else if (shapeKind === 'hexagon') {
    safeWidthRatio = 0.75;
    safeHeightRatio = 0.82;
  } else if (shapeKind === 'cylinder') {
    safeWidthRatio = 0.85;
    safeHeightRatio = 0.72;
  } else if (shapeKind === 'document') {
    safeWidthRatio = 0.85;
    safeHeightRatio = 0.80;
  } else if (shapeKind === 'parallelogram') {
    safeWidthRatio = 0.75;
    safeHeightRatio = 0.85;
  } else if (isSticky) {
    safeWidthRatio = 0.88;
    safeHeightRatio = 0.88;
  } else if (isText || isConnector) {
    safeWidthRatio = 1.0;
    safeHeightRatio = 1.0;
  }

  // Convert shape world coordinates to exact screen coordinates
  const screenPos = worldToScreen({ x: object.x, y: object.y }, viewport);
  const screenWidth = Math.max(60, object.width * viewport.zoom);
  const screenHeight = Math.max(32, object.height * viewport.zoom);

  const safeWidth = Math.max(40, screenWidth * safeWidthRatio);
  const safeMaxHeight = Math.max(24, screenHeight * safeHeightRatio);

  const defaultFontSize = object.type === 'text' ? 16 : object.type === 'sticky' ? 13 : 14;
  const baseFontSize = textStyle?.fontSize ?? defaultFontSize;
  const scaledFontSize = Math.max(11, Math.round(baseFontSize * viewport.zoom));

  const defaultAlign = (object.type === 'sticky' || object.type === 'text') ? 'left' : 'center';
  const textAlign = textStyle?.textAlign ?? defaultAlign;

  const colorMeta = isSticky && 'color' in object ? STICKY_COLOR_MAP[(object as any).color] : null;
  const textColor = textStyle?.textColor ?? (isSticky && colorMeta ? colorMeta.text : '#1e293b');

  const defaultFontWeight = object.type === 'shape' ? '500' : 'normal';
  const fontWeight = textStyle?.fontWeight ?? defaultFontWeight;
  const fontStyle = textStyle?.fontStyle ?? 'normal';
  const rot = object.rotation ?? 0;

  const verticalAlign: 'middle' | 'top' = isSticky ? 'top' : 'middle';

  // Measure and adjust textarea height dynamically so it centers vertically
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const scrollH = el.scrollHeight;
    const isOverflowing = scrollH > safeMaxHeight;
    const newH = Math.max(Math.round(scaledFontSize * 1.4), Math.min(safeMaxHeight, scrollH));
    el.style.height = `${newH}px`;
    el.style.overflowY = isOverflowing ? 'auto' : 'hidden';
  }, [text, scaledFontSize, safeMaxHeight, safeWidth]);

  return (
    <div
      style={{
        position: 'absolute',
        left: `${screenPos.x}px`,
        top: `${screenPos.y}px`,
        width: `${screenWidth}px`,
        height: `${screenHeight}px`,
        transform: rot ? `rotate(${rot}deg)` : undefined,
        transformOrigin: 'center center',
        zIndex: 50,
      }}
      className="pointer-events-auto flex items-center justify-center select-none"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {/* Floating Rich Text Formatting Toolbar */}
      <div className="floating-text-toolbar">
        <FloatingTextToolbar
          position={{ x: screenWidth / 2, y: -12 }}
          activeFormats={activeFormats}
          currentStyle={textStyle}
          onToggleFormat={handleToggleFormat}
          onToggleList={handleToggleList}
          onChangeStyle={(newStyle) => {
            onChangeStyle?.(newStyle);
            requestAnimationFrame(() => {
              textareaRef.current?.focus();
            });
          }}
        />
      </div>

      {/* Inner Safe Bounds Container for Textarea */}
      <div
        style={{
          width: `${safeWidth}px`,
          maxHeight: `${safeMaxHeight}px`,
          height: verticalAlign === 'top' ? `${safeMaxHeight}px` : 'auto',
        }}
        className={`flex flex-col justify-center ${
          verticalAlign === 'top' ? 'items-start pt-2' : 'items-center'
        }`}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onSelect={updateActiveFormats}
          onKeyUp={updateActiveFormats}
          onMouseUp={updateActiveFormats}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          placeholder="Type text..."
          style={{
            width: '100%',
            fontSize: `${scaledFontSize}px`,
            textAlign,
            color: textColor,
            fontWeight,
            fontStyle,
            lineHeight: 1.35,
            backgroundColor: 'transparent',
            border: '1.5px dashed rgba(59, 130, 246, 0.75)',
            borderRadius: '4px',
            padding: '2px 4px',
            caretColor: '#2563eb',
            boxSizing: 'border-box',
          }}
          className="outline-none resize-none font-sans select-text transition-all"
        />
      </div>

      {/* Helper hint */}
      <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 bg-slate-900/80 text-white text-[10px] font-sans font-medium rounded shadow-sm pointer-events-none select-none">
        Enter: new line • Ctrl+B/I/U: format • Ctrl+Enter: done
      </div>
    </div>
  );
};
