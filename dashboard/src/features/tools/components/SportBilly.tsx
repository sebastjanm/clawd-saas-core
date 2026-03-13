'use client';

import { useState } from 'react';
import { ImageTool } from './ImageTool';
import { SttTool } from './SttTool';
import { TtsTool } from './TtsTool';
import { VideoTool } from './VideoTool';
import { BrandTool } from './BrandTool';
import { HistoryTool } from './HistoryTool';
import { UsageTool } from './UsageTool';

const TABS = [
  { id: 'image', label: '🎨 Image Gen' },
  { id: 'tts', label: '🔊 Text to Speech' },
  { id: 'stt', label: '🎙️ Speech to Text' },
  { id: 'video', label: '🎬 Video' },
  { id: 'brand', label: '🏭 Brand' },
  { id: 'llm', label: '🧠 LLM' },
  { id: 'history', label: '📜 History' },
  { id: 'usage', label: '📊 Usage' },
] as const;

const CONTENT: Record<string, React.FC | null> = {
  image: ImageTool,
  stt: SttTool,
  tts: TtsTool,
  video: VideoTool,
  brand: BrandTool,
  history: HistoryTool,
  usage: UsageTool,
};

export function SportBilly() {
  const [activeTab, setActiveTab] = useState<string>('image');

  const ActiveComponent = CONTENT[activeTab] ?? null;

  return (
    <div className="space-y-4">
      {/* Tabs — simple underline style */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-sm transition-colors relative ${
              activeTab === tab.id
                ? 'text-[var(--foreground)] font-medium'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--accent)]" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {ActiveComponent ? (
          <ActiveComponent />
        ) : (
          <div className="flex items-center justify-center h-64 text-[var(--text-tertiary)]">
            Coming soon...
          </div>
        )}
      </div>
    </div>
  );
}
