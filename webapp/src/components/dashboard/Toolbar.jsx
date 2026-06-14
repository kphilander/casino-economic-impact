import React, { useState } from 'react';
import { Save, FolderOpen, Share2, Download, Printer, FileSpreadsheet, FileText, Presentation, GitCompare, Check, X } from 'lucide-react';
import Button from '../ui/Button';

/**
 * Dashboard action bar: save/open named projects, copy a shareable link,
 * export (Word report / PPTX deck / CSV / print-to-PDF), and toggle scenario
 * comparison. The Word and PPTX reports are license-gated (Pro) — the parent
 * handles the paywall when those callbacks fire.
 */
export default function Toolbar({
  disabled, defaultName, projectCount,
  onSaveProject, onCopyShare, shareCopied,
  onOpenProjects, onExportCSV, onPrint, onExportWord, onExportPPTX,
  generatingWord, generatingPPTX,
  compareActive, onToggleCompare, canCompare,
}) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [exportOpen, setExportOpen] = useState(false);

  const startSave = () => { setName(defaultName || ''); setSaving(true); };
  const confirmSave = () => { onSaveProject(name); setSaving(false); };

  return (
    <div className="surface px-3 py-2.5 mb-6 flex items-center gap-2 flex-wrap no-print relative">
      {saving ? (
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <input
            autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') confirmSave(); if (e.key === 'Escape') setSaving(false); }}
            placeholder="Name this analysis…"
            className="field-input px-3 py-1.5 text-sm flex-1"
          />
          <Button size="sm" variant="primary" icon={Check} onClick={confirmSave}>Save</Button>
          <Button size="sm" variant="ghost" icon={X} onClick={() => setSaving(false)} aria-label="Cancel" />
        </div>
      ) : (
        <>
          <Button size="sm" variant="secondary" icon={Save} onClick={startSave} disabled={disabled}>Save</Button>
          <Button size="sm" variant="secondary" icon={FolderOpen} onClick={onOpenProjects}>
            Open{projectCount > 0 ? ` (${projectCount})` : ''}
          </Button>
          <Button size="sm" variant="secondary" icon={shareCopied ? Check : Share2} onClick={onCopyShare} disabled={disabled}>
            {shareCopied ? 'Link copied' : 'Share'}
          </Button>

          <div className="relative">
            <Button size="sm" variant="secondary" icon={Download} onClick={() => setExportOpen((o) => !o)} disabled={disabled}>
              Export
            </Button>
            {exportOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                <div className="absolute left-0 mt-1.5 z-20 w-60 bg-white border border-hairline rounded-xl shadow-pop py-1.5">
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-text-faint">Full report</p>
                  {onExportWord && (
                    <button onClick={() => { onExportWord(); setExportOpen(false); }} disabled={generatingWord}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-paper disabled:opacity-60">
                      <FileText size={16} className="text-accent" /> {generatingWord ? 'Building Word report…' : 'Word report (.docx)'}
                    </button>
                  )}
                  {onExportPPTX && (
                    <button onClick={() => { onExportPPTX(); setExportOpen(false); }} disabled={generatingPPTX}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-paper disabled:opacity-60">
                      <Presentation size={16} className="text-accent" /> {generatingPPTX ? 'Building deck…' : 'PowerPoint deck (.pptx)'}
                    </button>
                  )}
                  <p className="px-3 pt-2 pb-1 mt-1 border-t border-hairline text-[10px] font-semibold uppercase tracking-wide text-text-faint">Data</p>
                  <button onClick={() => { onExportCSV(); setExportOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-paper">
                    <FileSpreadsheet size={16} className="text-text-muted" /> CSV (Excel)
                  </button>
                  <button onClick={() => { onPrint(); setExportOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-paper">
                    <Printer size={16} className="text-text-muted" /> Print / Save as PDF
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex-1" />

          <Button
            size="sm"
            variant={compareActive ? 'accent' : 'secondary'}
            icon={GitCompare}
            onClick={onToggleCompare}
            disabled={!canCompare}
          >
            Compare scenarios
          </Button>
        </>
      )}
    </div>
  );
}
