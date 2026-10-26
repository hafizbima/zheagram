import { BoardObject } from '@diagrammer/shared';

export interface Command {
  name: string;
  execute(): void;
  undo(): void;
  redo?(): void;
}

export interface IDocumentStore {
  getState(): {
    id: string;
    title: string;
    objects: Record<string, BoardObject>;
    order: string[];
  };
  addObject(obj: BoardObject, recordHistory?: boolean): void;
  deleteObject(id: string, recordHistory?: boolean): void;
  updateObject(obj: BoardObject, recordHistory?: boolean): void;
  reorderObjects(newOrder: string[], recordHistory?: boolean): void;
}

export class AddObjectsCommand implements Command {
  name = 'Add Objects';

  constructor(
    private store: IDocumentStore,
    private objects: BoardObject[]
  ) {}

  execute(): void {
    for (const obj of this.objects) {
      this.store.addObject(obj, false);
    }
  }

  undo(): void {
    for (const obj of this.objects) {
      this.store.deleteObject(obj.id, false);
    }
  }

  redo(): void {
    this.execute();
  }
}

export class DeleteObjectsCommand implements Command {
  name = 'Delete Objects';
  private savedObjects: BoardObject[] = [];
  private savedOrder: string[] = [];

  constructor(
    private store: IDocumentStore,
    private objectIds: string[]
  ) {}

  execute(): void {
    const state = this.store.getState();
    this.savedOrder = [...state.order];
    this.savedObjects = this.objectIds
      .map((id) => state.objects[id])
      .filter((o): o is BoardObject => Boolean(o));

    for (const id of this.objectIds) {
      this.store.deleteObject(id, false);
    }
  }

  undo(): void {
    for (const obj of this.savedObjects) {
      this.store.addObject(obj, false);
    }
    this.store.reorderObjects(this.savedOrder, false);
  }

  redo(): void {
    this.execute();
  }
}

export class UpdateObjectsCommand implements Command {
  name = 'Update Objects';

  constructor(
    private store: IDocumentStore,
    private prevObjects: BoardObject[],
    private nextObjects: BoardObject[]
  ) {}

  execute(): void {
    for (const obj of this.nextObjects) {
      this.store.updateObject(obj, false);
    }
  }

  undo(): void {
    for (const obj of this.prevObjects) {
      this.store.updateObject(obj, false);
    }
  }

  redo(): void {
    this.execute();
  }
}

export class ReorderCommand implements Command {
  name = 'Reorder Objects';

  constructor(
    private store: IDocumentStore,
    private prevOrder: string[],
    private nextOrder: string[]
  ) {}

  execute(): void {
    this.store.reorderObjects(this.nextOrder, false);
  }

  undo(): void {
    this.store.reorderObjects(this.prevOrder, false);
  }

  redo(): void {
    this.execute();
  }
}

export class CommandManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxCommands = 200;

  execute(cmd: Command): void {
    cmd.execute();
    this.undoStack.push(cmd);
    if (this.undoStack.length > this.maxCommands) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo(): boolean {
    const cmd = this.undoStack.pop();
    if (!cmd) return false;
    cmd.undo();
    this.redoStack.push(cmd);
    return true;
  }

  redo(): boolean {
    const cmd = this.redoStack.pop();
    if (!cmd) return false;
    if (cmd.redo) {
      cmd.redo();
    } else {
      cmd.execute();
    }
    this.undoStack.push(cmd);
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
