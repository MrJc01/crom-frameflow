import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandManager, type Command } from '../CommandManager';

describe('CommandManager', () => {
    let manager: CommandManager;

    beforeEach(() => {
        manager = new CommandManager();
    });

    it('should execute a command', () => {
        const executeMock = vi.fn();
        const undoMock = vi.fn();
        const command: Command = { execute: executeMock, undo: undoMock };
        
        manager.execute(command);
        expect(executeMock).toHaveBeenCalled();
        expect(manager.canUndo()).toBe(true);
    });

    it('should undo a command', () => {
        const executeMock = vi.fn();
        const undoMock = vi.fn();
        const command: Command = { execute: executeMock, undo: undoMock };
        
        manager.execute(command);
        manager.undo();
        
        expect(undoMock).toHaveBeenCalled();
        expect(manager.canUndo()).toBe(false);
        expect(manager.canRedo()).toBe(true);
    });

    it('should redo a command', () => {
        const executeMock = vi.fn();
        const undoMock = vi.fn();
        const command: Command = { execute: executeMock, undo: undoMock };
        
        manager.execute(command);
        manager.undo();
        manager.redo();
        
        expect(executeMock).toHaveBeenCalledTimes(2); // Once initially, once on redo
        expect(manager.canRedo()).toBe(false);
    });
});
