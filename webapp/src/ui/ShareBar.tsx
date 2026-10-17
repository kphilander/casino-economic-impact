import { useEffect, useRef, useState } from 'react';
import { PROPERTY_TYPES, type Analysis } from '../engine/scenario';
import { deleteProject, loadProjects, renameProject, saveProject, shareUrl, type Project } from '../engine/share';

const defaultName = (a: Analysis) => a.name.trim() || `${a.state}, ${PROPERTY_TYPES[a.propertyType].label.toLowerCase()}`;

export function ShareBar({ analysis, onLoad, onCompare }: { analysis: Analysis; onLoad: (a: Analysis) => void; onCompare: () => void }) {
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [open, setOpen] = useState<'save' | 'projects' | 'link' | null>(null);
  const [name, setName] = useState('');
  const [flash, setFlash] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const linkRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2500);
    return () => clearTimeout(t);
  }, [flash]);

  const copyLink = async () => {
    const url = shareUrl(analysis);
    setLink(url);
    try {
      await navigator.clipboard.writeText(url);
      setFlash('Link copied');
      setOpen(null);
    } catch {
      // Clipboard access can be refused; show the link to copy by hand.
      setOpen('link');
      setTimeout(() => linkRef.current?.select(), 0);
    }
  };

  return (
    <div className="sharebar">
      <button type="button" className="btn" onClick={() => { setName(defaultName(analysis)); setOpen(open === 'save' ? null : 'save'); }}>Save</button>
      <button type="button" className="btn" onClick={() => { setProjects(loadProjects()); setOpen(open === 'projects' ? null : 'projects'); }}>
        Projects{projects.length ? ` (${projects.length})` : ''}
      </button>
      <button type="button" className="btn" onClick={copyLink}>Copy share link</button>
      <button type="button" className="btn" onClick={onCompare}>Add to comparison</button>
      {flash && <span className="flash" role="status">{flash}</span>}

      {open === 'save' && (
        <form className="popover" onSubmit={(e) => {
          e.preventDefault();
          setProjects(saveProject(name, analysis));
          setOpen(null);
          setFlash('Saved in this browser');
        }}>
          <label htmlFor="save-name">Project name</label>
          <input id="save-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <div className="popover-actions">
            <button type="submit" className="btn primary">Save</button>
            <button type="button" className="btn" onClick={() => setOpen(null)}>Cancel</button>
          </div>
          <p className="hint">Projects are stored in this browser only. Use a share link to move an analysis to another device.</p>
        </form>
      )}

      {open === 'link' && (
        <div className="popover">
          <label htmlFor="share-link">Share link</label>
          <input id="share-link" ref={linkRef} readOnly value={link} onFocus={(e) => e.target.select()} />
          <p className="hint">The link contains every input of the analysis; no data is sent to a server.</p>
          <div className="popover-actions"><button type="button" className="btn" onClick={() => setOpen(null)}>Close</button></div>
        </div>
      )}

      {open === 'projects' && (
        <div className="popover wide">
          {projects.length === 0 ? <p className="hint">No saved projects in this browser.</p> : (
            <ul className="projects">
              {projects.map((p) => (
                <li key={p.id}>
                  {renaming?.id === p.id ? (
                    <form className="rename" onSubmit={(e) => { e.preventDefault(); setProjects(renameProject(p.id, renaming.name)); setRenaming(null); }}>
                      <input aria-label="New name" value={renaming.name} onChange={(e) => setRenaming({ id: p.id, name: e.target.value })} autoFocus />
                      <button type="submit" className="link">OK</button>
                    </form>
                  ) : (
                    <div className="project-name">
                      <strong>{p.name}</strong>
                      <span className="muted">{p.analysis.state} · {p.savedAt ? new Date(p.savedAt).toLocaleDateString() : ''}</span>
                    </div>
                  )}
                  <div className="project-actions">
                    <button type="button" className="link" onClick={() => { onLoad(p.analysis); setOpen(null); setFlash(`Loaded ${p.name}`); }}>Load</button>
                    <button type="button" className="link" onClick={() => setRenaming({ id: p.id, name: p.name })}>Rename</button>
                    {confirmDelete === p.id ? (
                      <button type="button" className="link danger" onClick={() => { setProjects(deleteProject(p.id)); setConfirmDelete(null); }}>Confirm delete</button>
                    ) : (
                      <button type="button" className="link" onClick={() => setConfirmDelete(p.id)}>Delete</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
