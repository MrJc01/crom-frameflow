import React, { useState } from 'react';
import { X, MessageSquare, Bug, Lightbulb, Send } from 'lucide-react';
import { ariaButton, ariaDialog } from '../utils/a11y';
import { toast } from 'sonner';

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type FeedbackType = 'bug' | 'feature' | 'other';

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
    const [type, setType] = useState<FeedbackType>('bug');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // In a real app, this would POST to an API
        // For now, we'll open a GitHub Issue pre-filled
        
        const labels = type === 'bug' ? 'bug' : type === 'feature' ? 'enhancement' : 'documentation';
        const body = encodeURIComponent(`**Description**\n${description}\n\n**Environment**\n- OS: ${navigator.platform}\n- UA: ${navigator.userAgent}`);
        const subject = encodeURIComponent(`[${type.toUpperCase()}] ${title}`);
        
        // Construct GitHub Issue URL (using a placeholder repo for now, or the real one if known)
        const repoUrl = 'https://github.com/MrJc01/crom-frameflow/issues/new';
        const url = `${repoUrl}?title=${subject}&body=${body}&labels=${labels}`;
        
        window.open(url, '_blank');
        toast.success('Redirecting to GitHub Issues...');
        onClose();
        
        // Reset form
        setTitle('');
        setDescription('');
        setType('bug');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" {...ariaDialog('Send Feedback')}>
            <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-blue-400" />
                        Send Feedback
                    </h2>
                    <button onClick={onClose} {...ariaButton('Close')} className="p-1 hover:bg-gray-800 rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="flex gap-2 p-1 bg-gray-800 rounded-lg">
                        <button
                            type="button"
                            onClick={() => setType('bug')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-sm font-medium transition-colors ${type === 'bug' ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Bug className="w-4 h-4" /> Bug
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('feature')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-sm font-medium transition-colors ${type === 'feature' ? 'bg-purple-500/20 text-purple-400' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Lightbulb className="w-4 h-4" /> Feature
                        </button>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full bg-black/30 border border-gray-700 rounded p-2 text-white focus:border-blue-500 outline-none"
                            placeholder="Brief summary..."
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full h-32 bg-black/30 border border-gray-700 rounded p-2 text-white focus:border-blue-500 outline-none resize-none"
                            placeholder="Explain the issue or idea..."
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors"
                    >
                        <Send className="w-4 h-4" />
                        Submit Report
                    </button>
                    
                    <p className="text-xs text-center text-gray-500">
                        This will open a new GitHub Issue in your browser.
                    </p>
                </form>
            </div>
        </div>
    );
};
