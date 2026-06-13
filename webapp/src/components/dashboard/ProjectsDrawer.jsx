import React from 'react';
import { X, FolderOpen, Trash2, Clock, MapPin } from 'lucide-react';

const PROPERTY_LABELS = {
  '721120': 'Resort + Casino',
  '713210': 'Stand-alone Casino',
  '713290': 'Slots / Bingo',
  '722410': 'Bar/Restaurant + Slots',
  ONLINE_CASINO: 'Online Casino',
  ONLINE_SPORTSBOOK: 'Online Sportsbook',
};

function timeAgo(iso) {
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Slide-over panel listing locally-saved analyses. Open restores all inputs;
 * delete removes the saved project.
 */
export default function ProjectsDrawer({ open, projects, onClose, onOpenProject, onDelete }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] no-print" role="dialog" aria-label="Saved analyses">
      <div className="absolute inset-0 modal-backdrop" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-pop flex flex-col animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
          <h2 className="font-display text-lg font-semibold text-ink flex items-center gap-2">
            <FolderOpen size={18} className="text-accent" /> Saved Analyses
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-ink" aria-label="Close"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {projects.length === 0 ? (
            <div className="text-center py-16 px-6">
              <FolderOpen size={36} className="mx-auto text-text-faint mb-3" strokeWidth={1.5} />
              <p className="text-sm text-text-muted">No saved analyses yet.</p>
              <p className="text-xs text-text-faint mt-1">Use <span className="font-medium">Save</span> in the toolbar to keep an analysis here on this device.</p>
            </div>
          ) : (
            projects.map((p) => (
              <div key={p.id} className="surface-sunken p-3.5 hover:border-[#c6cdd7] transition-colors group">
                <div className="flex items-start justify-between gap-3">
                  <button onClick={() => onOpenProject(p)} className="text-left min-w-0 flex-1">
                    <p className="font-semibold text-ink text-sm truncate">{p.name}</p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-text-muted">
                      <span className="flex items-center gap-1"><MapPin size={11} />{p.analysis.state}</span>
                      <span>{PROPERTY_LABELS[p.analysis.propertyType] || 'Custom'}</span>
                      <span className="flex items-center gap-1"><Clock size={11} />{timeAgo(p.savedAt)}</span>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => onOpenProject(p)}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg border border-hairline text-accent hover:bg-accent-soft transition-colors">
                      Open
                    </button>
                    <button onClick={() => onDelete(p.id)}
                      className="p-1.5 text-text-faint hover:text-negative opacity-0 group-hover:opacity-100 transition-all" aria-label="Delete">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="px-5 py-3 border-t border-hairline">
          <p className="text-[11px] text-text-faint">Saved in this browser only — share a link to send an analysis to someone else.</p>
        </div>
      </div>
    </div>
  );
}
