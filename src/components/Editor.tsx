import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Check,
  ChevronLeft,
  Code2,
  Eraser,
  Heading2,
  Italic,
  List,
  ListOrdered,
  LoaderCircle,
  PanelRightClose,
  PanelRightOpen,
  Quote,
  Redo2,
  RotateCcw,
  Star,
  Strikethrough,
  Trash2,
  Undo2,
} from "lucide-react";
import type { EntryInput } from "../types";
import { formatLongDate, formatTime } from "../lib/date";
import { renderMarkdown } from "../lib/markdown";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

interface EditorProps {
  draft: EntryInput;
  isTrashed: boolean;
  collapsed: boolean;
  saveState: SaveState;
  savedAt?: string;
  onChange: (patch: Partial<EntryInput>) => void;
  onSave: () => void;
  onToggleFavorite: () => void;
  onTrash: () => void;
  onRestore: () => void;
  onDeleteForever: () => void;
  onBack: () => void;
  onCollapse: () => void;
  onExpand: () => void;
}

function selectionLabel(saveState: SaveState, savedAt?: string): string {
  if (saveState === "saving") {
    return "正在保存";
  }
  if (saveState === "dirty") {
    return "等待保存";
  }
  if (saveState === "error") {
    return "保存失败";
  }
  if (saveState === "saved" && savedAt) {
    return `已保存 ${formatTime(savedAt)}`;
  }
  return "自动保存";
}

function contentToHtml(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) {
    return "";
  }

  if (
    /^<(p|h[1-6]|ul|ol|li|blockquote|pre|code|strong|em|s|hr)\b/i.test(
      trimmed,
    )
  ) {
    return trimmed;
  }

  return renderMarkdown(content);
}

export function Editor({
  draft,
  isTrashed,
  collapsed,
  saveState,
  savedAt,
  onChange,
  onSave,
  onToggleFavorite,
  onTrash,
  onRestore,
  onDeleteForever,
  onBack,
  onCollapse,
  onExpand,
}: EditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: "写下此刻的想法...",
      }),
    ],
    content: contentToHtml(draft.content),
    editable: !isTrashed,
    editorProps: {
      attributes: {
        class: "rich-editor-content",
        spellcheck: "true",
      },
      handleDOMEvents: {
        blur: () => {
          onSave();
          return false;
        },
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange({ content: currentEditor.getHTML() });
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.commands.setContent(contentToHtml(draft.content), false);
  }, [draft.id, editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.setEditable(!isTrashed);
  }, [editor, isTrashed]);

  const formatActions = editor
    ? [
        {
          label: "撤销",
          icon: Undo2,
          active: false,
          disabled: !editor.can().undo(),
          run: () => editor.chain().focus().undo().run(),
        },
        {
          label: "重做",
          icon: Redo2,
          active: false,
          disabled: !editor.can().redo(),
          run: () => editor.chain().focus().redo().run(),
        },
        {
          label: "加粗",
          icon: Bold,
          active: editor.isActive("bold"),
          disabled: false,
          run: () => editor.chain().focus().toggleBold().run(),
        },
        {
          label: "斜体",
          icon: Italic,
          active: editor.isActive("italic"),
          disabled: false,
          run: () => editor.chain().focus().toggleItalic().run(),
        },
        {
          label: "删除线",
          icon: Strikethrough,
          active: editor.isActive("strike"),
          disabled: false,
          run: () => editor.chain().focus().toggleStrike().run(),
        },
        {
          label: "二级标题",
          icon: Heading2,
          active: editor.isActive("heading", { level: 2 }),
          disabled: false,
          run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        },
        {
          label: "无序列表",
          icon: List,
          active: editor.isActive("bulletList"),
          disabled: false,
          run: () => editor.chain().focus().toggleBulletList().run(),
        },
        {
          label: "有序列表",
          icon: ListOrdered,
          active: editor.isActive("orderedList"),
          disabled: false,
          run: () => editor.chain().focus().toggleOrderedList().run(),
        },
        {
          label: "引用",
          icon: Quote,
          active: editor.isActive("blockquote"),
          disabled: false,
          run: () => editor.chain().focus().toggleBlockquote().run(),
        },
        {
          label: "代码块",
          icon: Code2,
          active: editor.isActive("codeBlock"),
          disabled: false,
          run: () => editor.chain().focus().toggleCodeBlock().run(),
        },
        {
          label: "清除格式",
          icon: Eraser,
          active: false,
          disabled: false,
          run: () =>
            editor.chain().focus().unsetAllMarks().clearNodes().run(),
        },
      ]
    : [];

  if (collapsed) {
    return (
      <aside className="editor-pane editor-pane--collapsed">
        <button
          className="icon-button collapsed-rail__button"
          type="button"
          aria-label="展开编辑器"
          title="展开编辑器"
          onClick={onExpand}
        >
          <PanelRightOpen size={18} />
        </button>
        <span className="collapsed-rail__label">编辑</span>
        <span
          className={`collapsed-rail__state collapsed-rail__state--${saveState}`}
          title={selectionLabel(saveState, savedAt)}
        />
      </aside>
    );
  }

  return (
    <main className="editor-pane">
      <header className="editor-toolbar">
        <button
          className="icon-button editor-back"
          type="button"
          aria-label="返回日记列表"
          title="返回"
          onClick={onBack}
        >
          <ChevronLeft size={18} />
        </button>
        <div className="editor-toolbar__date">
          <span>{formatLongDate(draft.entryDate)}</span>
          <div className={`save-status save-status--${saveState}`}>
            {saveState === "saving" ? (
              <LoaderCircle className="spin" size={13} />
            ) : saveState === "saved" ? (
              <Check size={13} />
            ) : null}
            <span>{selectionLabel(saveState, savedAt)}</span>
          </div>
        </div>

        <div className="editor-toolbar__actions">
          <button
            className="icon-button"
            type="button"
            aria-label="收起编辑器"
            title="收起编辑器"
            onClick={onCollapse}
          >
            <PanelRightClose size={17} />
          </button>
          {!isTrashed ? (
            <>
              <button
                className={`icon-button ${draft.favorite ? "is-active" : ""}`}
                type="button"
                aria-label={draft.favorite ? "取消收藏" : "收藏"}
                title={draft.favorite ? "取消收藏" : "收藏"}
                onClick={onToggleFavorite}
              >
                <Star
                  size={17}
                  fill={draft.favorite ? "currentColor" : "none"}
                />
              </button>
              <button
                className="icon-button icon-button--danger"
                type="button"
                aria-label="移到回收站"
                title="移到回收站"
                onClick={onTrash}
              >
                <Trash2 size={17} />
              </button>
            </>
          ) : (
            <>
              <button
                className="button button--ghost button--compact"
                type="button"
                onClick={onRestore}
              >
                <RotateCcw size={15} />
                恢复
              </button>
              <button
                className="button button--danger button--compact"
                type="button"
                onClick={onDeleteForever}
              >
                <Trash2 size={15} />
                永久删除
              </button>
            </>
          )}
        </div>
      </header>

      <div className="editor-scroll">
        <article className="editor-document">
          {isTrashed ? (
            <div className="trash-banner">
              这篇日记在回收站中，恢复后才能继续编辑。
            </div>
          ) : null}

          <input
            className="editor-title"
            value={draft.title}
            placeholder="标题（可选）"
            aria-label="日记标题"
            readOnly={isTrashed}
            onChange={(event) => onChange({ title: event.target.value })}
          />

          <div className="editor-metadata">
            <label>
              <span>日期</span>
              <input
                type="date"
                value={draft.entryDate}
                disabled={isTrashed}
                onChange={(event) =>
                  onChange({ entryDate: event.target.value })
                }
              />
            </label>
          </div>

          {editor && !isTrashed ? (
            <div
              className="format-toolbar"
              role="toolbar"
              aria-label="文本格式"
            >
              {formatActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <div className="format-toolbar__group" key={action.label}>
                    {index === 2 || index === 5 || index === 10 ? (
                      <span className="format-toolbar__divider" />
                    ) : null}
                    <button
                      className={`format-button ${
                        action.active ? "is-active" : ""
                      }`}
                      type="button"
                      aria-label={action.label}
                      aria-pressed={action.active}
                      disabled={action.disabled}
                      title={action.label}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={action.run}
                    >
                      <Icon size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="rich-editor">
            <EditorContent editor={editor} />
          </div>

          <footer className="editor-footer">
            <span>
              {editor?.getText().replace(/\s/g, "").length ?? 0} 字
            </span>
            <span>自动保存</span>
            {savedAt ? <span>最后修改 {formatTime(savedAt)}</span> : null}
          </footer>
        </article>
      </div>
    </main>
  );
}
