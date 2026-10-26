import React, { useState, useRef, useEffect } from 'react';
import { ViewportTransform, SwimlaneObject } from '@diagrammer/shared';
import { worldToScreen, SwimlaneComputedLane } from '@diagrammer/engine';

interface InlineLaneTitleEditorProps {
  swimlane: SwimlaneObject;
  lane: SwimlaneComputedLane;
  viewport: ViewportTransform;
  onCommit: (newTitle: string) => void;
  onCancel: () => void;
}

export const InlineLaneTitleEditor: React.FC<InlineLaneTitleEditorProps> = ({
  swimlane,
  lane,
  viewport,
  onCommit,
  onCancel,
}) => {
  const [title, setTitle] = useState(lane.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const isCommittedRef = useRef(false);

  useEffect(() => {
    isCommittedRef.current = false;
    setTitle(lane.title);
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 20);
    return () => clearTimeout(timer);
  }, [lane.id]);

  const handleCommit = () => {
    if (isCommittedRef.current) return;
    isCommittedRef.current = true;
    const trimmed = title.trim();
    if (trimmed && trimmed !== lane.title) {
      onCommit(trimmed);
    } else {
      onCancel();
    }
  };

  const screenOrigin = worldToScreen(
    { x: lane.headerBounds.x, y: lane.headerBounds.y },
    viewport
  );
  const screenWidth = Math.max(60, lane.headerBounds.width * viewport.zoom);
  const screenHeight = Math.max(28, lane.headerBounds.height * viewport.zoom);

  return (
    <div
      style={{
        position: 'absolute',
        left: screenOrigin.x,
        top: screenOrigin.y,
        width: screenWidth,
        height: screenHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        zIndex: 40,
        padding: '3px 6px',
        boxSizing: 'border-box',
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleCommit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            isCommittedRef.current = true;
            onCancel();
          }
        }}
        onBlur={handleCommit}
        className="w-full text-center font-sans font-semibold text-slate-800 bg-white border-2 border-blue-500 rounded-lg shadow-md focus:outline-none"
        style={{
          fontSize: `${Math.max(11, Math.min(16, 12 * Math.sqrt(viewport.zoom)))}px`,
          padding: '3px 6px',
        }}
      />
    </div>
  );
};
