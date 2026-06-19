"use client";

import * as React from "react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type RichEmailEditorValue = {
  html: string;
  text: string;
};

export type RichEmailEditorHandle = {
  focus: () => void;
  insertText: (text: string) => void;
};

type RichEmailEditorProps = {
  value: string;
  onChange: (value: RichEmailEditorValue) => void;
  onFocus?: () => void;
  placeholder?: string;
  minHeightClassName?: string;
  disabled?: boolean;
};

const EMPTY_HTML = "<p></p>";

function normalizeEditorHtml(value: string): string {
  return value.trim() ? value : EMPTY_HTML;
}

function editorToValue(editor: Editor): RichEmailEditorValue {
  if (editor.isEmpty) return { html: "", text: "" };
  const doc = editor.state.doc;
  const text = doc.textBetween(0, doc.content.size, "\n\n").trim();
  return { html: editor.getHTML(), text };
}

type ToolbarButtonProps = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

function ToolbarButton({
  label,
  icon: Icon,
  active,
  disabled,
  onClick,
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant={active ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
          />
        }
      >
        <Icon className="size-4" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export const RichEmailEditor = React.forwardRef<
  RichEmailEditorHandle,
  RichEmailEditorProps
>(function RichEmailEditor(
  {
    value,
    onChange,
    onFocus,
    placeholder = "Escribe el mensaje...",
    minHeightClassName = "min-h-52",
    disabled = false,
  },
  ref,
) {
  const onChangeRef = React.useRef(onChange);
  const onFocusRef = React.useRef(onFocus);

  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  React.useEffect(() => {
    onFocusRef.current = onFocus;
  }, [onFocus]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        link: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: normalizeEditorHtml(value),
    editable: !disabled,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: cn(
          "tiptap px-3 py-2 text-sm leading-6 outline-none",
          minHeightClassName,
        ),
      },
    },
    onFocus: () => onFocusRef.current?.(),
    onUpdate: ({ editor: nextEditor }) => {
      onChangeRef.current(editorToValue(nextEditor));
    },
  });

  React.useEffect(() => {
    if (!editor) return;
    const next = normalizeEditorHtml(value);
    if (editor.getHTML() !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, value]);

  React.useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  React.useImperativeHandle(
    ref,
    () => ({
      focus() {
        editor?.chain().focus().run();
      },
      insertText(text: string) {
        editor?.chain().focus().insertContent(text).run();
      },
    }),
    [editor],
  );

  const canEdit = Boolean(editor && !disabled);

  return (
    <div
      className={cn(
        "nexo-rich-editor bg-background focus-within:border-ring focus-within:ring-ring/50 overflow-hidden rounded-md border shadow-xs transition focus-within:ring-[3px]",
        disabled && "opacity-60",
      )}
    >
      <div className="bg-muted/35 flex flex-wrap items-center gap-1 border-b px-2 py-1">
        <ToolbarButton
          label="Negrita"
          icon={Bold}
          active={editor?.isActive("bold")}
          disabled={!canEdit}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="Cursiva"
          icon={Italic}
          active={editor?.isActive("italic")}
          disabled={!canEdit}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="Subrayado"
          icon={Underline}
          active={editor?.isActive("underline")}
          disabled={!canEdit}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        />
        <ToolbarButton
          label="Tachado"
          icon={Strikethrough}
          active={editor?.isActive("strike")}
          disabled={!canEdit}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        />
        <span className="bg-border mx-1 h-5 w-px" />
        <ToolbarButton
          label="Lista"
          icon={List}
          active={editor?.isActive("bulletList")}
          disabled={!canEdit}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          label="Lista numerada"
          icon={ListOrdered}
          active={editor?.isActive("orderedList")}
          disabled={!canEdit}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          label="Cita"
          icon={Quote}
          active={editor?.isActive("blockquote")}
          disabled={!canEdit}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        />
        <span className="bg-border mx-1 h-5 w-px" />
        <ToolbarButton
          label="Limpiar formato"
          icon={RemoveFormatting}
          disabled={!canEdit}
          onClick={() =>
            editor?.chain().focus().unsetAllMarks().clearNodes().run()
          }
        />
        <div className="ml-auto flex items-center gap-1">
          <ToolbarButton
            label="Deshacer"
            icon={Undo2}
            disabled={!canEdit || !editor?.can().undo()}
            onClick={() => editor?.chain().focus().undo().run()}
          />
          <ToolbarButton
            label="Rehacer"
            icon={Redo2}
            disabled={!canEdit || !editor?.can().redo()}
            onClick={() => editor?.chain().focus().redo().run()}
          />
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
});

RichEmailEditor.displayName = "RichEmailEditor";
