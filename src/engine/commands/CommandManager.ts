
export interface Command {
  execute: () => void;
  undo: () => void;
  description?: string; // For UI tooltips ("Undo Add Clip")
}

export class CommandManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxHistory: number = 50;
  
  // Callback for UI updates (hooked into Zustand later)
  private notify: () => void = () => {};

  setNotifyCallback(cb: () => void) {
      this.notify = cb;
  }

  execute(command: Command) {
      command.execute();
      this.undoStack.push(command);
      this.redoStack = []; // Clear redo stack on new action
      
      if (this.undoStack.length > this.maxHistory) {
          this.undoStack.shift();
      }
      this.notify();
  }

  undo() {
      const command = this.undoStack.pop();
      if (command) {
          command.undo();
          this.redoStack.push(command);
          this.notify();
      }
  }

  redo() {
      const command = this.redoStack.pop();
      if (command) {
          command.execute();
          this.undoStack.push(command);
          this.notify();
      }
  }
  
  canUndo(): boolean {
      return this.undoStack.length > 0;
  }
  
  canRedo(): boolean {
      return this.redoStack.length > 0;
  }

  getHistory(): { undoStack: Command[], redoStack: Command[] } {
      return {
          undoStack: [...this.undoStack],
          redoStack: [...this.redoStack]
      };
  }
}

export const commandManager = new CommandManager();
