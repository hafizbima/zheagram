import { BoardObject, FrameObject, StickyObject, ShapeObject, ConnectorObject } from '@diagrammer/shared';

export interface TemplateDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  badge?: string;
  generate: (originX: number, originY: number) => BoardObject[];
}

export const TEMPLATES: Record<string, TemplateDefinition> = {
  kanban: {
    id: 'kanban',
    name: 'Kanban Board',
    category: 'Agile & Planning',
    description: 'Track workflow tasks across To Do, In Progress, and Done stages with sticky notes.',
    badge: 'Popular',
    generate: (originX = 100, originY = 100) => {
      const objects: BoardObject[] = [];
      const colWidth = 280;
      const colHeight = 520;
      const gap = 30;

      const columns = [
        {
          name: 'To Do',
          color: 'blue' as const,
          items: ['Research competitor features', 'Create onboarding walk-through', 'Setup automated QA tests'],
        },
        {
          name: 'In Progress',
          color: 'yellow' as const,
          items: ['Implement Infinite Canvas', 'Optimize Spatial Indexing', 'Multiplayer cursor synchronization'],
        },
        {
          name: 'Done',
          color: 'green' as const,
          items: ['Project initial setup', 'Tailwind & React 18 integration', 'Export to PNG & SVG engine'],
        },
      ];

      columns.forEach((col, idx) => {
        const x = originX + idx * (colWidth + gap);
        const y = originY;
        const frameId = `frame-kanban-${idx}-${Date.now()}`;

        const frame: FrameObject = {
          id: frameId,
          type: 'frame',
          name: col.name,
          x,
          y,
          width: colWidth,
          height: colHeight,
          style: {
            fill: '#f8fafc',
            stroke: '#cbd5e1',
            strokeWidth: 1.5,
          },
        };
        objects.push(frame);

        col.items.forEach((itemText, itemIdx) => {
          const stickyId = `sticky-${idx}-${itemIdx}-${Date.now()}`;
          const sticky: StickyObject = {
            id: stickyId,
            type: 'sticky',
            frameId,
            x: x + 25,
            y: y + 50 + itemIdx * 140,
            width: 230,
            height: 115,
            color: col.color,
            text: itemText,
            author: ['Alex D.', 'Sarah K.', 'Ken W.'][itemIdx % 3],
            tag: ['High Priority', 'Design', 'Core Engine'][itemIdx % 3],
            reaction: ['🚀', '✨', '👍'][itemIdx % 3],
            textStyle: {
              fontSize: 13,
              textAlign: 'left',
              textColor: '#1e293b',
              fontWeight: '500',
            },
          };
          objects.push(sticky);
        });
      });

      return objects;
    },
  },

  retrospective: {
    id: 'retrospective',
    name: 'Sprint Retrospective',
    category: 'Agile & Team',
    description: 'Reflect on recent sprint: What went well, what could be improved, and action items.',
    badge: 'Essential',
    generate: (originX = 100, originY = 100) => {
      const objects: BoardObject[] = [];
      const colWidth = 300;
      const colHeight = 520;
      const gap = 30;

      const columns = [
        {
          title: 'What Went Well 🎉',
          color: 'green' as const,
          notes: ['Smooth release of Canvas Engine', 'Great pair-programming synergy', 'Sub-millisecond spatial queries'],
        },
        {
          title: 'What Needs Work 🤔',
          color: 'pink' as const,
          notes: ['Test coverage on mobile touch events', 'Clarify connector arrow styles earlier', 'Reduce initial bundle footprint'],
        },
        {
          title: 'Action Items 💡',
          color: 'purple' as const,
          notes: ['Refactor touch gesture recognizer', 'Add automated e2e canvas interaction test', 'Schedule design review bi-weekly'],
        },
      ];

      columns.forEach((col, idx) => {
        const x = originX + idx * (colWidth + gap);
        const y = originY;
        const frameId = `frame-retro-${idx}-${Date.now()}`;

        objects.push({
          id: frameId,
          type: 'frame',
          name: col.title,
          x,
          y,
          width: colWidth,
          height: colHeight,
          style: {
            fill: '#f8fafc',
            stroke: '#cbd5e1',
            strokeWidth: 1.5,
          },
        });

        col.notes.forEach((text, itemIdx) => {
          objects.push({
            id: `sticky-retro-${idx}-${itemIdx}-${Date.now()}`,
            type: 'sticky',
            frameId,
            x: x + 25,
            y: y + 50 + itemIdx * 140,
            width: 250,
            height: 115,
            color: col.color,
            text,
            author: ['Budi P.', 'Sarah M.', 'Ken T.'][itemIdx % 3],
            reaction: ['❤️', '🔥', '💡'][itemIdx % 3],
            textStyle: {
              fontSize: 13,
              textAlign: 'left',
              textColor: '#1e293b',
              fontWeight: '500',
            },
          });
        });
      });

      return objects;
    },
  },

  brainstorm: {
    id: 'brainstorm',
    name: 'Brainstorming Sticky Notes',
    category: 'Brainstorming & Ideation',
    description: 'Capture ideas quickly with a focused canvas of colorful sticky notes.',
    badge: 'Quick Start',
    generate: (originX = 200, originY = 150) => {
      const ideas = [
        { text: 'What problem are we solving?', color: 'blue' as const, dx: 0, dy: 0 },
        { text: 'Who is this for?', color: 'yellow' as const, dx: 190, dy: 20 },
        { text: 'What should we try first?', color: 'green' as const, dx: 380, dy: 0 },
        { text: 'Risks and constraints', color: 'pink' as const, dx: 80, dy: 190 },
        { text: 'Unexpected opportunities', color: 'purple' as const, dx: 280, dy: 210 },
        { text: 'Next actions', color: 'orange' as const, dx: 480, dy: 180 },
      ];

      return ideas.map((idea, index): StickyObject => ({
        id: `sticky-brainstorm-${index}-${Date.now()}`,
        type: 'sticky',
        x: originX + idea.dx,
        y: originY + idea.dy,
        width: 160,
        height: 140,
        rotation: index % 2 === 0 ? -1 : 1,
        color: idea.color,
        text: idea.text,
        author: 'You',
        textStyle: {
          fontSize: 14,
          textAlign: 'left',
          textColor: '#1e293b',
          fontWeight: '500',
        },
      }));
    },
  },

  mindmap: {
    id: 'mindmap',
    name: 'Mind Map',
    category: 'Brainstorming & Ideation',
    description: 'Structure complex ideas radially from a central theme to interconnected branches.',
    badge: 'Popular',
    generate: (originX = 400, originY = 300) => {
      const objects: BoardObject[] = [];
      const centerId = `center-node-${Date.now()}`;

      // Center Node
      const centerNode: ShapeObject = {
        id: centerId,
        type: 'shape',
        kind: 'rounded-rectangle',
        x: originX,
        y: originY,
        width: 220,
        height: 90,
        text: 'Miro Clone Platform',
        style: {
          fill: '#eff6ff',
          stroke: '#3b82f6',
          strokeWidth: 3,
          cornerRadius: 16,
          shadow: true,
        },
        textStyle: {
          fontSize: 16,
          fontWeight: '700',
          textAlign: 'center',
          textColor: '#1d4ed8',
        },
      };
      objects.push(centerNode);

      const branches = [
        { label: 'Infinite Canvas Engine', color: '#10b981', dx: 320, dy: -140 },
        { label: 'Realtime Collaboration', color: '#8b5cf6', dx: 320, dy: 140 },
        { label: 'Smart Connectors', color: '#f59e0b', dx: -320, dy: -140 },
        { label: 'Export & Templates', color: '#ec4899', dx: -320, dy: 140 },
      ];

      branches.forEach((b, idx) => {
        const branchId = `branch-${idx}-${Date.now()}`;
        const branchShape: ShapeObject = {
          id: branchId,
          type: 'shape',
          kind: 'rounded-rectangle',
          x: originX + b.dx,
          y: originY + b.dy,
          width: 200,
          height: 75,
          text: b.label,
          style: {
            fill: '#ffffff',
            stroke: b.color,
            strokeWidth: 2,
            cornerRadius: 12,
            shadow: true,
          },
          textStyle: {
            fontSize: 13,
            fontWeight: '600',
            textAlign: 'center',
            textColor: '#1e293b',
          },
        };
        objects.push(branchShape);

        const connId = `conn-branch-${idx}-${Date.now()}`;
        const conn: ConnectorObject = {
          id: connId,
          type: 'connector',
          from: { objectId: centerId, anchor: b.dx > 0 ? 'right' : 'left' },
          to: { objectId: branchId, anchor: b.dx > 0 ? 'left' : 'right' },
          routing: 'curved',
          style: {
            stroke: b.color,
            strokeWidth: 2.5,
            endArrowhead: 'arrow',
          },
        };
        objects.push(conn);
      });

      return objects;
    },
  },

  matrix2x2: {
    id: 'matrix2x2',
    name: '2x2 Prioritization Matrix',
    category: 'Strategy & Decision',
    description: 'Categorize initiatives by Impact vs Effort to discover high-value quick wins.',
    generate: (originX = 100, originY = 100) => {
      const objects: BoardObject[] = [];
      const boxSize = 260;

      const quadrants = [
        { name: '⭐ Quick Wins (High Impact, Low Effort)', x: originX, y: originY, bg: '#ecfdf5', border: '#10b981', note: 'Fast-flowchart node shortcuts' },
        { name: '🚀 Major Projects (High Impact, High Effort)', x: originX + boxSize + 20, y: originY, bg: '#eff6ff', border: '#3b82f6', note: 'Offline CRDT LocalFirst database' },
        { name: '⏳ Fill-ins (Low Impact, Low Effort)', x: originX, y: originY + boxSize + 20, bg: '#fffbeb', border: '#f59e0b', note: 'Custom board theme presets' },
        { name: '⛔ Time Sinks (Low Impact, High Effort)', x: originX + boxSize + 20, y: originY + boxSize + 20, bg: '#fef2f2', border: '#ef4444', note: 'Legacy browser fallbacks' },
      ];

      quadrants.forEach((q, idx) => {
        const frameId = `matrix-q-${idx}-${Date.now()}`;
        objects.push({
          id: frameId,
          type: 'frame',
          name: q.name,
          x: q.x,
          y: q.y,
          width: boxSize,
          height: boxSize,
          style: {
            fill: q.bg,
            stroke: q.border,
            strokeWidth: 2,
          },
        });

        objects.push({
          id: `matrix-sticky-${idx}-${Date.now()}`,
          type: 'sticky',
          frameId,
          x: q.x + 25,
          y: q.y + 60,
          width: 210,
          height: 110,
          color: idx === 0 ? 'green' : idx === 1 ? 'blue' : idx === 2 ? 'yellow' : 'pink',
          text: q.note,
          textStyle: {
            fontSize: 13,
            textAlign: 'left',
            textColor: '#1e293b',
          },
        });
      });

      return objects;
    },
  },
};
