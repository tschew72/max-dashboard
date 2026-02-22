'use client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { useCallback } from 'react'
import {
  Bold, Italic, UnderlineIcon, Strikethrough, Code, List,
  ListOrdered, CheckSquare, Link2, Heading2, Heading3, Minus,
} from 'lucide-react'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
  readOnly?: boolean
}

const BTN = `flex items-center justify-center w-7 h-7 rounded text-sm transition-all`
const BTN_ACTIVE = `bg-blue-600/30 text-blue-300`
const BTN_IDLE = `text-[#8c9bab] hover:text-white hover:bg-white/10`

function ToolbarButton({
  onClick, active, title, children,
}: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      className={`${BTN} ${active ? BTN_ACTIVE : BTN_IDLE}`}
    >
      {children}
    </button>
  )
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write task details, steps, context...',
  minHeight = 180,
  readOnly = false,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,   // ← prevents TipTap SSR/hydration mismatch in Next.js
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: { HTMLAttributes: { class: 'tiptap-code-block' } },
        blockquote: { HTMLAttributes: { class: 'tiptap-blockquote' } },
      }),
      Underline,
      TaskList.configure({ HTMLAttributes: { class: 'tiptap-task-list' } }),
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      // treat empty paragraph as empty string
      onChange(html === '<p></p>' ? '' : html)
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor focus:outline-none',
        style: `min-height:${minHeight}px; padding: 12px 14px; font-size: 14px; line-height: 1.65; color: #b6c2cf;`,
      },
    },
  })

  // Note: external value sync not needed — BottomSheet unmounts/remounts the
  // editor on open/close, so `content` prop is always fresh on mount.

  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href
    const url = window.prompt('Enter URL', prev)
    if (url === null) return
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  if (!editor) return null

  if (readOnly) {
    return (
      <div className="tiptap-render">
        <EditorContent editor={editor} />
      </div>
    )
  }

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid #2c333a', background: '#1a1f24' }}
    >
      {/* Toolbar */}
      <div
        className="flex flex-wrap items-center gap-0.5 px-2 py-1.5"
        style={{ borderBottom: '1px solid #2c333a', background: '#161b20' }}
      >
        {/* Text style */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
          <Bold size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
          <Italic size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
          <UnderlineIcon size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
          <Strikethrough size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code">
          <Code size={13} />
        </ToolbarButton>

        <span className="w-px h-4 mx-1" style={{ background: '#2c333a' }} />

        {/* Headings */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
          <Heading2 size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
          <Heading3 size={13} />
        </ToolbarButton>

        <span className="w-px h-4 mx-1" style={{ background: '#2c333a' }} />

        {/* Lists */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
          <List size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
          <ListOrdered size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Checklist">
          <CheckSquare size={13} />
        </ToolbarButton>

        <span className="w-px h-4 mx-1" style={{ background: '#2c333a' }} />

        {/* Extra */}
        <ToolbarButton onClick={setLink} active={editor.isActive('link')} title="Link">
          <Link2 size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="Divider">
          <Minus size={13} />
        </ToolbarButton>
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  )
}

/** Render-only: safely displays stored HTML */
export function RichTextRender({ html, className }: { html: string; className?: string }) {
  if (!html || html === '<p></p>') return null
  return (
    <div
      className={`tiptap-render ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
