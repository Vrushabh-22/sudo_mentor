import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { ImageIcon, Pin, PinOff, Trash2, X } from 'lucide-react';
import { Note } from './useNotes';
import { NoteToolbar } from './NoteToolbar';
import { uploadNoteCover } from './uploadNoteCover';

interface Props {
  note: Note;
  onChange: (patch: Partial<Note>) => Promise<void> | void;
  onArchive: () => void;
  onTogglePin: (pinned: boolean) => void;
}

const ICONS = ['📝', '📌', '💡', '✅', '📅', '🚀', '🎯', '🧠', '⭐', '🔥', '📚', '🛠️'];

export function NoteEditor({ note, onChange, onArchive, onTogglePin }: Props) {
  const [title, setTitle] = useState(note.title);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const saveTimer = useRef<number | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({}),
      Placeholder.configure({ placeholder: "Type '/' for commands, or just start writing…" }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: note.content || { type: 'doc', content: [{ type: 'paragraph' }] },
    editorProps: {
      attributes: {
        class: 'prose prose-slate prose-sm sm:prose-base max-w-none focus:outline-none min-h-[400px] px-10 py-6',
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        onChange({ content: json });
      }, 500);
    },
  }, [note.id]);

  useEffect(() => { setTitle(note.title); }, [note.id, note.title]);

  const commitTitle = () => {
    if (title !== note.title) onChange({ title: title || 'Untitled' });
  };

  const handleCoverPick = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadNoteCover(file);
      await onChange({ cover_url: url });
    } catch (e: any) {
      alert(e?.message || 'Cover upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      {note.cover_url ? (
        <div className="relative group h-56 w-full overflow-hidden">
          <img src={note.cover_url} alt="" className="w-full h-full object-cover" />
          <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition">
            <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 text-xs rounded-md bg-black/60 text-white hover:bg-black/80">Change cover</button>
            <button onClick={() => onChange({ cover_url: null })} className="px-3 py-1.5 text-xs rounded-md bg-black/60 text-white hover:bg-black/80 inline-flex items-center gap-1"><X className="h-3 w-3" /> Remove</button>
          </div>
        </div>
      ) : null}

      <div className="max-w-3xl mx-auto px-10 pt-10">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setShowIconPicker(v => !v)}
            className="text-5xl hover:bg-slate-100 rounded-md p-1 -ml-1"
            title="Change icon"
          >
            {note.icon || '📝'}
          </button>
          {showIconPicker && (
            <div className="absolute mt-16 bg-white border border-slate-200 rounded-lg shadow-lg p-2 flex flex-wrap gap-1 w-64 z-20">
              {ICONS.map(i => (
                <button key={i} onClick={() => { onChange({ icon: i }); setShowIconPicker(false); }} className="text-2xl p-1 hover:bg-slate-100 rounded">{i}</button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mb-4 text-xs text-slate-500">
          {!note.cover_url && (
            <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 px-2 py-1 hover:bg-slate-100 rounded">
              <ImageIcon className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : 'Add cover'}
            </button>
          )}
          <button onClick={() => onTogglePin(!note.is_pinned)} className="inline-flex items-center gap-1 px-2 py-1 hover:bg-slate-100 rounded">
            {note.is_pinned ? <><PinOff className="h-3.5 w-3.5" /> Unpin</> : <><Pin className="h-3.5 w-3.5" /> Pin</>}
          </button>
          {note.kind === 'page' && (
            <button onClick={onArchive} className="inline-flex items-center gap-1 px-2 py-1 hover:bg-red-50 text-red-600 rounded">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) handleCoverPick(f);
            }}
          />
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitTitle(); editor?.commands.focus(); } }}
          placeholder="Untitled"
          className="w-full text-4xl font-bold bg-transparent border-0 outline-none text-slate-900 placeholder-slate-300 mb-2"
        />
      </div>

      <div className="max-w-3xl mx-auto">
        <NoteToolbar editor={editor} />
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
