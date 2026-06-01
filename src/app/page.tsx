"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage, type UIMessagePart } from "ai";
import { Car, Pencil, Scale, Send, Sparkles, User, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { CarShortlist } from "@/components/car-shortlist";
import { CompareSheet } from "@/components/compare-sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ShortlistResult } from "@/lib/chat-types";

const MAX_COMPARE = 3;

/**
 * Turn Google's verbose rate-limit error wall-of-text into a tight,
 * human-readable one-liner. Falls back to the raw message for non-quota errors.
 */
function formatChatError(err: Error): string {
  const msg = err.message ?? "";
  if (/quota|rate limit|429/i.test(msg)) {
    const retryMatch = msg.match(/retry in ([\d.]+)s/i);
    const retrySec = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : null;
    return retrySec
      ? `Rate-limited by Gemini's free tier — retry in ${retrySec}s.`
      : `Rate-limited by Gemini's free tier. Wait ~30s and try again.`;
  }
  return msg || "Something went wrong. Try again.";
}

const SUGGESTIONS = [
  "Budget 10L, daily city use",
  "First car for my family of 4, prioritise safety",
  "Long highway drives, premium feel",
];

type ChatPart = UIMessagePart<Record<string, unknown>, Record<string, never>>;

export default function HomePage() {
  const { messages, sendMessage, setMessages, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");
  const [comparedIds, setComparedIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const isStreaming = status === "submitted" || status === "streaming";
  const showEmpty = messages.length === 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  const toggleCompare = useCallback((id: string) => {
    setComparedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) return [...prev.slice(1), id];
      return [...prev, id];
    });
  }, []);

  const removeCompared = useCallback((id: string) => {
    setComparedIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const clearCompared = useCallback(() => {
    setComparedIds([]);
    setCompareOpen(false);
  }, []);

  const comparedSet = useMemo(() => new Set(comparedIds), [comparedIds]);

  const startEdit = useCallback(
    (messageId: string, currentText: string) => {
      if (isStreaming) return;
      setEditingId(messageId);
      setEditingText(currentText);
    },
    [isStreaming],
  );

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingText("");
  }, []);

  const submitEdit = useCallback(() => {
    if (!editingId) return;
    const text = editingText.trim();
    if (!text) return;
    const idx = messages.findIndex((m) => m.id === editingId);
    if (idx < 0) {
      cancelEdit();
      return;
    }
    setMessages(messages.slice(0, idx));
    sendMessage({ text });
    cancelEdit();
  }, [editingId, editingText, messages, setMessages, sendMessage, cancelEdit]);

  const submit = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    sendMessage({ text });
    setInput("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex h-screen flex-col bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-black">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          <div className="rounded-xl bg-primary/10 p-2">
            <Car className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-base font-semibold leading-tight">Car Concierge</h1>
            <p className="text-xs text-muted-foreground">
              AI-powered shortlisting for the Indian car market · 36 cars · powered by Gemini
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-8">
          {showEmpty ? (
            <EmptyState onPick={(text) => sendMessage({ text })} />
          ) : (
            <ul className="space-y-6">
              {messages.map((message) => (
                <li key={message.id}>
                  <MessageRow
                    message={message}
                    onCompare={toggleCompare}
                    comparedIds={comparedSet}
                    isEditing={editingId === message.id}
                    anyEditing={editingId !== null}
                    editingText={editingText}
                    onEditTextChange={setEditingText}
                    onStartEdit={startEdit}
                    onCancelEdit={cancelEdit}
                    onSubmitEdit={submitEdit}
                    canEdit={!isStreaming}
                  />
                </li>
              ))}
            </ul>
          )}
          <div ref={bottomRef} className="h-1" />
        </div>
      </main>

      {/* Floating Compare pill — visible only when at least one car is selected. */}
      {comparedIds.length > 0 && (
        <Button
          onClick={() => setCompareOpen(true)}
          className="fixed bottom-28 right-6 z-20 h-11 rounded-full pl-4 pr-5 shadow-lg"
          size="lg"
        >
          <Scale className="mr-2 h-4 w-4" />
          Compare ({comparedIds.length})
        </Button>
      )}

      <CompareSheet
        open={compareOpen}
        onOpenChange={setCompareOpen}
        carIds={comparedIds}
        onRemove={removeCompared}
        onClear={clearCompared}
      />

      <footer className="sticky bottom-0 border-t bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-4xl px-6 py-3">
          {isStreaming && (
            <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 animate-pulse" />
              Thinking…
            </p>
          )}
          {error && (
            <p className="mb-2 text-xs text-red-500">{formatChatError(error)}</p>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Tell me what kind of car you need… (budget, family size, usage)"
              className="min-h-[44px] max-h-40 resize-none"
              rows={1}
              disabled={isStreaming}
              autoFocus
            />
            <Button
              size="icon"
              onClick={submit}
              disabled={!input.trim() || isStreaming}
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Press{" "}
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[9px]">
              ⌘ / Ctrl + Enter
            </kbd>{" "}
            to send
          </p>
        </div>
      </footer>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center pt-20 text-center">
      <div className="rounded-2xl bg-primary/10 p-3">
        <Sparkles className="h-6 w-6 text-primary" />
      </div>
      <h2 className="mt-5 max-w-md text-2xl font-semibold leading-snug tracking-tight">
        From &ldquo;I don&rsquo;t know what to buy&rdquo; to &ldquo;I&rsquo;m confident.&rdquo;
      </h2>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        Describe your situation in plain English — budget, family size, how
        you&rsquo;ll use the car. I&rsquo;ll narrow 36 popular Indian cars to a confident
        3–5 car shortlist with personalised reasons for each.
      </p>
      <div className="mt-8 flex max-w-2xl flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((text) => (
          <Button
            key={text}
            variant="outline"
            size="sm"
            className="rounded-full text-xs"
            onClick={() => onPick(text)}
          >
            {text}
          </Button>
        ))}
      </div>
    </div>
  );
}

interface MessageRowProps {
  message: UIMessage;
  onCompare: (id: string) => void;
  comparedIds: ReadonlySet<string>;
  isEditing: boolean;
  anyEditing: boolean;
  editingText: string;
  onEditTextChange: (text: string) => void;
  onStartEdit: (id: string, currentText: string) => void;
  onCancelEdit: () => void;
  onSubmitEdit: () => void;
  canEdit: boolean;
}

function extractMessageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

function MessageRow({
  message,
  onCompare,
  comparedIds,
  isEditing,
  anyEditing,
  editingText,
  onEditTextChange,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  canEdit,
}: MessageRowProps) {
  const isUser = message.role === "user";
  const currentText = isUser ? extractMessageText(message) : "";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          className={
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground"
          }
        >
          {isUser ? (
            <User className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
        </AvatarFallback>
      </Avatar>
      <div
        className={`flex min-w-0 max-w-[85%] flex-1 flex-col gap-2 ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        {isUser && isEditing ? (
          <EditUserMessage
            value={editingText}
            originalText={currentText}
            onChange={onEditTextChange}
            onCancel={onCancelEdit}
            onSubmit={onSubmitEdit}
          />
        ) : (
          <>
            {message.parts.map((part, i) => (
              <PartRenderer
                key={`${message.id}-${i}`}
                part={part as ChatPart}
                isUser={isUser}
                onCompare={onCompare}
                comparedIds={comparedIds}
              />
            ))}
            {isUser && !anyEditing && (
              <Button
                variant="ghost"
                size="sm"
                className="-mt-0.5 h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => onStartEdit(message.id, currentText)}
                disabled={!canEdit}
                aria-label="Edit message"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface EditUserMessageProps {
  value: string;
  originalText: string;
  onChange: (text: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

function EditUserMessage({
  value,
  originalText,
  onChange,
  onCancel,
  onSubmit,
}: EditUserMessageProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // Focus + place caret at end when editor opens.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }, []);

  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && trimmed !== originalText.trim();

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (canSend) onSubmit();
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border bg-background p-2 shadow-sm">
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className="min-h-[60px] resize-none border-0 bg-transparent px-2 py-1 text-sm shadow-none focus-visible:ring-0"
        rows={3}
      />
      <div className="mt-1 flex items-center justify-end gap-2 px-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={onCancel}
        >
          <X className="mr-1 h-3 w-3" />
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={onSubmit}
          disabled={!canSend}
        >
          <Send className="mr-1 h-3 w-3" />
          Send
        </Button>
      </div>
    </div>
  );
}

interface PartRendererProps {
  part: ChatPart;
  isUser: boolean;
  onCompare: (id: string) => void;
  comparedIds: ReadonlySet<string>;
}

function PartRenderer({
  part,
  isUser,
  onCompare,
  comparedIds,
}: PartRendererProps) {
  if (part.type === "text") {
    if (!part.text) return null;
    return (
      <div
        className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
        }`}
      >
        {part.text}
      </div>
    );
  }

  if (part.type === "tool-shortlistCars") {
    return (
      <ToolShortlistPart
        part={part}
        onCompare={onCompare}
        comparedIds={comparedIds}
      />
    );
  }

  return null;
}

interface ToolPart {
  type: "tool-shortlistCars";
  state: "input-streaming" | "input-available" | "output-available" | "output-error";
  input?: { preferredUseCase?: string } | undefined;
  output?: unknown;
  errorText?: string;
}

interface ToolShortlistPartProps {
  part: ChatPart;
  onCompare: (id: string) => void;
  comparedIds: ReadonlySet<string>;
}

function ToolShortlistPart({
  part,
  onCompare,
  comparedIds,
}: ToolShortlistPartProps) {
 const toolPart = part as unknown as ToolPart;

  switch (toolPart.state) {
    case "input-streaming":
    case "input-available": {
      const hint = toolPart.input?.preferredUseCase
        ? ` for "${toolPart.input.preferredUseCase}"`
        : "…";
      return (
        <div className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <Sparkles className="mr-1.5 inline h-3 w-3 animate-pulse" />
          Filtering catalog{hint}
        </div>
      );
    }
    case "output-available": {
      const output = toolPart.output as ShortlistResult;
      return (
        <div className="w-full space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {output.cars.length} of {output.totalAfterFiltering} matched · filtered from{" "}
            {output.totalConsidered}
          </p>
          <CarShortlist
            cars={output.cars}
            onCompare={onCompare}
            comparedIds={comparedIds}
          />
        </div>
      );
    }
    case "output-error":
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Couldn&rsquo;t pull cars: {toolPart.errorText ?? "unknown error"}
        </div>
      );
    default:
      return null;
  }
}
