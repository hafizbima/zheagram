import { BoardObject, BoardState } from '@diagrammer/shared';
import { SpatialIndex } from '../spatial/spatialIndex';
import {
  CommandManager,
  Command,
  IDocumentStore,
  AddObjectsCommand,
  DeleteObjectsCommand,
  UpdateObjectsCommand,
  ReorderCommand,
} from '../commands';

export class DocumentStore implements IDocumentStore {
  private state: BoardState;
  private spatialIndex: SpatialIndex;
  private commandManager: CommandManager;
  private listeners: Set<(state: BoardState) => void> = new Set();

  constructor(initialData?: Partial<BoardState>) {
    this.spatialIndex = new SpatialIndex();
    this.commandManager = new CommandManager();

    this.state = {
      id: initialData?.id || 'board-default',
      title: initialData?.title || 'Untitled Diagram',
      objects: initialData?.objects || {},
      order: initialData?.order || [],
    };

    for (const id of this.state.order) {
      const obj = this.state.objects[id];
      if (obj && this.isIndexable(obj)) {
        this.spatialIndex.insert(obj as any);
      }
    }
  }

  private isIndexable(
    obj: BoardObject
  ): obj is BoardObject & { x: number; y: number; width: number; height: number } {
    return 'x' in obj && 'y' in obj && 'width' in obj && 'height' in obj;
  }

  getState(): BoardState {
    return this.state;
  }

  loadState(nextState: Partial<BoardState>): void {
    this.state = {
      id: nextState.id || 'board-default',
      title: nextState.title || 'Untitled Diagram',
      objects: nextState.objects || {},
      order: nextState.order || [],
    };

    this.commandManager.clear();
    this.spatialIndex.clear();

    for (const id of this.state.order) {
      const obj = this.state.objects[id];
      if (obj && this.isIndexable(obj)) {
        this.spatialIndex.insert(obj as any);
      }
    }

    this.notify();
  }

  getSpatialIndex(): SpatialIndex {
    return this.spatialIndex;
  }

  getCommandManager(): CommandManager {
    return this.commandManager;
  }

  executeCommand(command: Command): void {
    this.commandManager.execute(command);
    this.notify();
  }

  subscribe(listener: (state: BoardState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  addObject(obj: BoardObject, recordHistory: boolean = true): void {
    if (recordHistory) {
      this.executeCommand(new AddObjectsCommand(this, [obj]));
      return;
    }

    this.state.objects[obj.id] = obj;
    if (!this.state.order.includes(obj.id)) {
      this.state.order.push(obj.id);
    }

    if (this.isIndexable(obj)) {
      this.spatialIndex.insert(obj as any);
    }

    this.notify();
  }

  deleteObject(id: string, recordHistory: boolean = true): void {
    if (recordHistory) {
      this.executeCommand(new DeleteObjectsCommand(this, [id]));
      return;
    }

    const obj = this.state.objects[id];
    if (obj) {
      delete this.state.objects[id];
      this.state.order = this.state.order.filter((oId) => oId !== id);
      this.spatialIndex.remove(id);
      this.notify();
    }
  }

  updateObject(obj: BoardObject, recordHistory: boolean = false): void {
    const prev = this.state.objects[obj.id];
    if (recordHistory && prev) {
      this.executeCommand(new UpdateObjectsCommand(this, [prev], [obj]));
      return;
    }

    this.state.objects[obj.id] = obj;
    if (this.isIndexable(obj)) {
      this.spatialIndex.update(obj as any);
    }
    this.notify();
  }

  reorderObjects(newOrder: string[], recordHistory: boolean = false): void {
    if (recordHistory) {
      this.executeCommand(new ReorderCommand(this, [...this.state.order], [...newOrder]));
      return;
    }

    this.state.order = [...newOrder];
    this.notify();
  }

  undo(): boolean {
    const res = this.commandManager.undo();
    if (res) this.notify();
    return res;
  }

  redo(): boolean {
    const res = this.commandManager.redo();
    if (res) this.notify();
    return res;
  }
}
