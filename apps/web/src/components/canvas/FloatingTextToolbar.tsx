import React, { useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
} from 'lucide-react';
import { TextStyle } from '@diagrammer/shared';

export interface FloatingTextToolbarProps {
  position: { x: number; y: number };
  activeFormats: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    bullet?: boolean;
    numbered?: boolean;
  };
  currentStyle: TextStyle;
  onToggleFormat: (format: 'bold' | 'italic' | 'underline' | 'strikethrough') => void;
  onToggleList: (type: 'bullet' | 'numbered') => void;
  onChangeStyle: (style: Partial<TextStyle>) => void;
}

const TEXT_COLORS = [
  { label: 'Slate', value: '#1e293b' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Purple', value: '#9333ea' },
];

const FONT_SIZES = [12, 14, 16, 20, 24];

export const FloatingTextToolbar: React.FC<FloatingTextToolbarProps> = ({
  position,
  activeFormats,
  currentStyle,
  onToggleFormat,
  onToggleList,
  onChangeStyle,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);

  const activeColor = currentStyle.textColor || '#1e293b';
  const activeFontSize = currentStyle.fontSize || 14;
  const activeAlign = currentStyle.textAlign || 'center';

  return (
    <div
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -100%)',
        zIndex: 60,
      }}
      className="flex items-center gap-0.5 bg-white border border-slate-200 shadow-xl rounded-xl p-1 select-none pointer-events-auto animate-in fade-in zoom-in-95 duration-100"
      onMouseDown={(e) => {
        // Prevent textarea from losing focus when clicking toolbar buttons
        e.preventDefault();
        e.stopPropagation();
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Bold button */}
      <button
        type="button"
        title="Bold (Ctrl+B)"
        onClick={() => onToggleFormat('bold')}
        className={`p-1.5 rounded-lg text-xs transition-colors flex items-center justify-center ${
          activeFormats.bold || currentStyle.fontWeight === 'bold'
            ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
            : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        <Bold className="w-3.5 h-3.5" />
      </button>

      {/* Italic button */}
      <button
        type="button"
        title="Italic (Ctrl+I)"
        onClick={() => onToggleFormat('italic')}
        className={`p-1.5 rounded-lg text-xs transition-colors flex items-center justify-center ${
          activeFormats.italic || currentStyle.fontStyle === 'italic'
            ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200'
            : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        <Italic className="w-3.5 h-3.5" />
      </button>

      {/* Underline button */}
      <button
        type="button"
        title="Underline (Ctrl+U)"
        onClick={() => onToggleFormat('underline')}
        className={`p-1.5 rounded-lg text-xs transition-colors flex items-center justify-center ${
          activeFormats.underline
            ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200'
            : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        <Underline className="w-3.5 h-3.5" />
      </button>

      {/* Strikethrough button */}
      <button
        type="button"
        title="Strikethrough (Ctrl+Shift+S)"
        onClick={() => onToggleFormat('strikethrough')}
        className={`p-1.5 rounded-lg text-xs transition-colors flex items-center justify-center ${
          activeFormats.strikethrough
            ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200'
            : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        <Strikethrough className="w-3.5 h-3.5" />
      </button>

      {/* Divider */}
      <div className="h-4 w-px bg-slate-200 mx-0.5" />

      {/* Bullet List button */}
      <button
        type="button"
        title="Bullet List (- item)"
        onClick={() => onToggleList('bullet')}
        className={`p-1.5 rounded-lg text-xs transition-colors flex items-center justify-center ${
          activeFormats.bullet
            ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200'
            : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        <List className="w-3.5 h-3.5" />
      </button>

      {/* Numbered List button */}
      <button
        type="button"
        title="Numbered List (1. item)"
        onClick={() => onToggleList('numbered')}
        className={`p-1.5 rounded-lg text-xs transition-colors flex items-center justify-center ${
          activeFormats.numbered
            ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200'
            : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        <ListOrdered className="w-3.5 h-3.5" />
      </button>

      {/* Divider */}
      <div className="h-4 w-px bg-slate-200 mx-0.5" />

      {/* Font Size Selector */}
      <select
        value={activeFontSize}
        onChange={(e) => onChangeStyle({ fontSize: Number(e.target.value) })}
        className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-1.5 py-1 text-xs text-slate-700 font-medium outline-none cursor-pointer"
        title="Font Size"
      >
        {FONT_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}px
          </option>
        ))}
      </select>

      {/* Text Alignment */}
      <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5">
        <button
          type="button"
          title="Align Left"
          onClick={() => onChangeStyle({ textAlign: 'left' })}
          className={`p-1 rounded text-xs transition-colors ${
            activeAlign === 'left'
              ? 'bg-white shadow-xs text-blue-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <AlignLeft className="w-3 h-3" />
        </button>
        <button
          type="button"
          title="Align Center"
          onClick={() => onChangeStyle({ textAlign: 'center' })}
          className={`p-1 rounded text-xs transition-colors ${
            activeAlign === 'center'
              ? 'bg-white shadow-xs text-blue-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <AlignCenter className="w-3 h-3" />
        </button>
        <button
          type="button"
          title="Align Right"
          onClick={() => onChangeStyle({ textAlign: 'right' })}
          className={`p-1 rounded text-xs transition-colors ${
            activeAlign === 'right'
              ? 'bg-white shadow-xs text-blue-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <AlignRight className="w-3 h-3" />
        </button>
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-slate-200 mx-0.5" />

      {/* Color Picker Button */}
      <div className="relative">
        <button
          type="button"
          title="Text Color"
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="p-1.5 rounded-lg hover:bg-slate-100 flex items-center gap-1 text-slate-700 transition-colors"
        >
          <Palette className="w-3.5 h-3.5" />
          <span
            className="w-3 h-3 rounded-full border border-slate-300"
            style={{ backgroundColor: activeColor }}
          />
        </button>

        {showColorPicker && (
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 p-1.5 bg-white border border-slate-200 rounded-xl shadow-xl flex items-center gap-1 z-50 animate-in fade-in zoom-in-95 duration-100"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {TEXT_COLORS.map((col) => (
              <button
                key={col.value}
                type="button"
                title={col.label}
                onClick={() => {
                  onChangeStyle({ textColor: col.value });
                  setShowColorPicker(false);
                }}
                className={`w-5 h-5 rounded-full border transition-transform ${
                  activeColor === col.value
                    ? 'border-blue-600 ring-2 ring-blue-100 scale-110'
                    : 'border-slate-300 hover:scale-105'
                }`}
                style={{ backgroundColor: col.value }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
