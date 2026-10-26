import React, { useEffect, useState } from 'react';
import { useCanvasStore } from '../../stores/useCanvasStore';

export const MultiplayerCursorsOverlay: React.FC = () => {
  const { isMultiplayerEnabled, collaborators, documentStore } = useCanvasStore();
  const [liveCollabs, setLiveCollabs] = useState(collaborators);

  // Subtle wandering animation for simulated collaborators
  useEffect(() => {
    if (!isMultiplayerEnabled) return;

    const interval = setInterval(() => {
      setLiveCollabs((prev) =>
        prev.map((c, idx) => {
          const angle = Date.now() * 0.001 + idx * 2.1;
          const wanderX = Math.cos(angle) * 1.5;
          const wanderY = Math.sin(angle) * 1.2;
          return {
            ...c,
            x: c.x + wanderX,
            y: c.y + wanderY,
          };
        })
      );
    }, 50);

    return () => clearInterval(interval);
  }, [isMultiplayerEnabled]);

  if (!isMultiplayerEnabled) return null;

  const boardState = documentStore.getState();

  return (
    <g className="multiplayer-cursors-layer pointer-events-none">
      {/* 1. Collaborators' Active Selection Box */}
      {liveCollabs.map((collab) => {
        if (!collab.activeObjectId) return null;
        const targetObj = boardState.objects[collab.activeObjectId];
        if (!targetObj || !('x' in targetObj && 'y' in targetObj)) return null;

        return (
          <g key={`selection-${collab.id}`}>
            <rect
              x={targetObj.x - 4}
              y={targetObj.y - 4}
              width={targetObj.width + 8}
              height={targetObj.height + 8}
              rx={6}
              fill="none"
              stroke={collab.color}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              opacity={0.65}
            />
          </g>
        );
      })}

      {/* 2. Cursors & Name Pills */}
      {liveCollabs.map((collab) => (
        <g
          key={collab.id}
          transform={`translate(${collab.x}, ${collab.y})`}
          className="transition-transform duration-75"
        >
          {/* Cursor SVG Arrow */}
          <svg width="24" height="24" viewBox="0 0 24 24" className="drop-shadow-md">
            <path
              d="M 2 2 L 9 20 L 13 13 L 20 9 Z"
              fill={collab.color}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          </svg>

          {/* User Name Pill */}
          <g transform="translate(14, 18)">
            <rect
              rx="4"
              ry="4"
              width={collab.name.length * 7 + 16}
              height="20"
              fill={collab.color}
              className="shadow-sm"
            />
            <text
              x="8"
              y="14"
              fill="#ffffff"
              fontSize="11"
              fontWeight="600"
              className="font-sans"
            >
              {collab.name}
            </text>
          </g>
        </g>
      ))}
    </g>
  );
};
