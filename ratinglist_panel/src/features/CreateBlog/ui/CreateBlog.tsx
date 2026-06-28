import {
  ArrowRight,
  Bold,
  Code2,
  Eye,
  FileImage,
  FileText,
  Heading2,
  ImagePlus,
  Italic,
  Link,
  List,
  ListOrdered,
  Plus,
  Quote,
  Upload,
} from "lucide-react";
import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";

import type { BlogPostDraft } from "../../../entities/Blog";
import { Button } from "../../../shared/components/Button";
import { Input } from "../../../shared/components/Input";
import { MarkdownContent } from "../../../shared/components/MarkdownContent";
import { Modal } from "../../../shared/components/Modal";

interface CreateBlogProps {
  onCreate: (draft: BlogPostDraft) => void | Promise<void>;
  buttonLabel?: string;
  initialDraft?: BlogPostDraft;
  isOpen?: boolean;
  modalTitle?: string;
  submitLabel?: string;
  trigger?: ReactNode;
  onOpenChange?: (isOpen: boolean) => void;
}

type CreateStep = 1 | 2;

const summaryMaxLength = 220;
const backendUrl = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3000";
const mediaImageUrl = `${backendUrl}/api/media/image`;

const emptyDraft: BlogPostDraft = {
  title: "",
  imageUrl: "",
  summary: "",
  content: "",
};

export const CreateBlog = ({
  onCreate,
  buttonLabel = "Создать пост",
  initialDraft,
  isOpen,
  modalTitle = "Создание поста",
  submitLabel = "Опубликовать",
  trigger,
  onOpenChange,
}: CreateBlogProps) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [step, setStep] = useState<CreateStep>(1);
  const [draft, setDraft] = useState<BlogPostDraft>(initialDraft ?? emptyDraft);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingMarkdownImage, setIsUploadingMarkdownImage] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const markdownImageInputRef = useRef<HTMLInputElement | null>(null);
  const markdownTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const modalIsOpen = isOpen ?? internalIsOpen;

  const setModalOpen = (nextIsOpen: boolean) => {
    setInternalIsOpen(nextIsOpen);
    onOpenChange?.(nextIsOpen);
  };

  const closeModal = () => {
    setModalOpen(false);
    setStep(1);
    setDraft(initialDraft ?? emptyDraft);
    setError("");
    setIsSubmitting(false);
    setPreviewContent(null);
  };

  const updateDraft = (field: keyof BlogPostDraft, value: string) => {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
    setError("");

    if (field === "content") {
      setPreviewContent(null);
    }
  };

  const readImageFile = (file: File, onLoad: (dataUrl: string) => void) => {
    if (!file.type.startsWith("image/")) {
      setError("Выберите файл изображения.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onLoad(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const uploadImage = async (dataUrl: string): Promise<string> => {
    const response = await fetch(mediaImageUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ dataUrl }),
    });

    if (!response.ok) {
      let message = "Не удалось загрузить картинку.";

      try {
        const text = await response.clone().text();
        const data = text ? JSON.parse(text) : null;
        message = typeof data?.message === "string" ? data.message : message;
      } catch {
        const text = await response.clone().text();

        if (text) {
          message = text;
        }
      }

      throw new Error(message);
    }

    const data = (await response.json()) as { secure_url?: string; url?: string };
    const imageUrl = data.secure_url ?? data.url;

    if (!imageUrl) {
      throw new Error("Backend не вернул URL картинки.");
    }

    return imageUrl;
  };

  const handleCoverUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    readImageFile(file, (dataUrl) => updateDraft("imageUrl", dataUrl));
    event.target.value = "";
  };

  const insertMarkdown = (before: string, after = "", placeholder = "текст") => {
    const textarea = markdownTextareaRef.current;

    if (!textarea) {
      updateDraft("content", `${draft.content}${before}${placeholder}${after}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = draft.content.slice(start, end) || placeholder;
    const nextContent = `${draft.content.slice(0, start)}${before}${selectedText}${after}${draft.content.slice(end)}`;
    const nextCursorPosition = start + before.length + selectedText.length + after.length;

    updateDraft("content", nextContent);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });
  };

  const insertMarkdownBlock = (template: string) => {
    const prefix = draft.content && !draft.content.endsWith("\n") ? "\n" : "";
    updateDraft("content", `${draft.content}${prefix}${template}`);
    window.requestAnimationFrame(() => markdownTextareaRef.current?.focus());
  };

  const insertMarkdownText = (text: string) => {
    const textarea = markdownTextareaRef.current;

    if (!textarea) {
      updateDraft("content", `${draft.content}${text}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextContent = `${draft.content.slice(0, start)}${text}${draft.content.slice(end)}`;
    const nextCursorPosition = start + text.length;

    updateDraft("content", nextContent);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });
  };

  const handleMarkdownImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Выберите файл изображения.");
      return;
    }

    setIsUploadingMarkdownImage(true);
    setError("");

    readImageFile(file, (dataUrl) => {
      uploadImage(dataUrl)
        .then((imageUrl) => {
          insertMarkdownText(`![${file.name}](${imageUrl})`);
        })
        .catch((uploadError) => {
          setError(
            uploadError instanceof Error
              ? uploadError.message
              : "Не удалось загрузить картинку.",
          );
        })
        .finally(() => {
          setIsUploadingMarkdownImage(false);
        });
    });
    event.target.value = "";
  };

  const canMoveToContent =
    draft.title.trim() && draft.imageUrl.trim() && draft.summary.trim();

  const handleNext = () => {
    if (!canMoveToContent) {
      setError("Заполните заголовок, картинку и краткое описание.");
      return;
    }

    setStep(2);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!canMoveToContent) {
      setStep(1);
      setError("Заполните заголовок, картинку и краткое описание.");
      return;
    }

    if (!draft.content.trim()) {
      setError("Добавьте полное Markdown-описание.");
      return;
    }

    setIsSubmitting(true);

    try {
      await onCreate({
        title: draft.title.trim(),
        imageUrl: draft.imageUrl.trim(),
        summary: draft.summary.trim(),
        content: draft.content.trim(),
      });
      closeModal();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Не удалось сохранить блог.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {trigger ?? (
        isOpen === undefined && (
          <Button icon={<Plus className="size-4" />} onClick={() => setModalOpen(true)}>
            {buttonLabel}
          </Button>
        )
      )}

      <Modal
        isOpen={modalIsOpen}
        size="large"
        title={modalTitle}
        description={step === 1 ? "Карточка публикации" : "Полный Markdown-текст"}
        onClose={closeModal}
        footer={(
          <>
            <Button
              disabled={isSubmitting}
              variant="secondary"
              onClick={step === 1 ? closeModal : () => setStep(1)}
            >
              {step === 1 ? "Отмена" : "Назад"}
            </Button>
            {step === 1 ? (
              <Button
                disabled={isSubmitting}
                icon={<ArrowRight className="size-4" />}
                onClick={handleNext}
              >
                Далее
              </Button>
            ) : (
              <Button
                disabled={isSubmitting || isUploadingMarkdownImage}
                form="create-blog-form"
                type="submit"
              >
                {isSubmitting
                  ? "Сохраняем..."
                  : isUploadingMarkdownImage
                    ? "Загружаем..."
                    : submitLabel}
              </Button>
            )}
          </>
        )}
      >
        <form id="create-blog-form" className="space-y-5" onSubmit={handleSubmit}>
          <div className="rounded-2xl border border-border bg-surface-muted px-4 py-4">
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
              <div className={[
                "flex size-10 items-center justify-center rounded-full border text-sm font-black",
                step === 1 ? "border-primary bg-primary text-primary-foreground" : "border-primary bg-primary-muted text-primary",
              ].join(" ")}
              >
                1
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: step === 1 ? "45%" : "100%" }}
                />
              </div>
              <div className={[
                "flex size-10 items-center justify-center rounded-full border text-sm font-black",
                step === 2 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-muted-foreground",
              ].join(" ")}
              >
                2
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs font-bold uppercase tracking-[0.14em]">
              <span className={step === 1 ? "text-primary" : "text-muted-foreground"}>
                Обложка и анонс
              </span>
              <span className={["text-right", step === 2 ? "text-primary" : "text-muted-foreground"].join(" ")}>
                Markdown
              </span>
            </div>
          </div>

          {step === 1 ? (
            <div className="grid gap-4">
              <Input
                autoFocus
                label="Заголовок"
                placeholder="Например: Обновление рейтингового листа"
                value={draft.title}
                leftIcon={<FileText className="size-4" />}
                onChange={(event) => updateDraft("title", event.target.value)}
              />
              <div>
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Картинка
                </span>
                <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                  <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-surface-muted">
                    {draft.imageUrl ? (
                      <img
                        alt="Обложка блога"
                        className="h-full w-full object-cover"
                        src={draft.imageUrl}
                      />
                    ) : (
                      <FileImage className="size-10 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-col justify-center gap-3 rounded-xl border border-border bg-surface px-4 py-4">
                    <p className="text-sm font-semibold text-foreground">
                      Загрузите обложку для карточки блога.
                    </p>
                    <Button
                      className="w-fit"
                      icon={<Upload className="size-4" />}
                      variant="secondary"
                      onClick={() => coverInputRef.current?.click()}
                    >
                      Выбрать файл
                    </Button>
                    <input
                      ref={coverInputRef}
                      accept="image/*"
                      className="hidden"
                      type="file"
                      onChange={handleCoverUpload}
                    />
                  </div>
                </div>
              </div>
              <label className="block">
                <span className="mb-2 flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  <span>Краткое описание</span>
                  <span>{draft.summary.length}/{summaryMaxLength}</span>
                </span>
                <textarea
                  maxLength={summaryMaxLength}
                  className="min-h-28 w-full resize-y rounded-xl border border-input bg-surface px-3 py-3 text-sm font-semibold text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary-muted"
                  placeholder="Короткий текст для карточки блога"
                  value={draft.summary}
                  onChange={(event) => updateDraft("summary", event.target.value)}
                />
              </label>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface-muted p-2">
                <Button aria-label="Заголовок" isIconOnly size="small" variant="tertiary" icon={<Heading2 className="size-4" />} onClick={() => insertMarkdownBlock("## Заголовок\n")} />
                <Button aria-label="Жирный текст" isIconOnly size="small" variant="tertiary" icon={<Bold className="size-4" />} onClick={() => insertMarkdown("**", "**", "жирный текст")} />
                <Button aria-label="Курсив" isIconOnly size="small" variant="tertiary" icon={<Italic className="size-4" />} onClick={() => insertMarkdown("*", "*", "курсив")} />
                <Button aria-label="Маркированный список" isIconOnly size="small" variant="tertiary" icon={<List className="size-4" />} onClick={() => insertMarkdownBlock("- Пункт списка\n")} />
                <Button aria-label="Нумерованный список" isIconOnly size="small" variant="tertiary" icon={<ListOrdered className="size-4" />} onClick={() => insertMarkdownBlock("1. Пункт списка\n")} />
                <Button aria-label="Цитата" isIconOnly size="small" variant="tertiary" icon={<Quote className="size-4" />} onClick={() => insertMarkdownBlock("> Цитата\n")} />
                <Button aria-label="Блок кода" isIconOnly size="small" variant="tertiary" icon={<Code2 className="size-4" />} onClick={() => insertMarkdownBlock("```\nкод\n```\n")} />
                <Button aria-label="Ссылка" isIconOnly size="small" variant="tertiary" icon={<Link className="size-4" />} onClick={() => insertMarkdown("[", "](https://example.com)", "ссылка")} />
                <Button
                  aria-label="Загрузить картинку в Markdown"
                  disabled={isUploadingMarkdownImage}
                  isIconOnly
                  size="small"
                  variant="tertiary"
                  icon={<ImagePlus className="size-4" />}
                  onClick={() => markdownImageInputRef.current?.click()}
                />
                <Button
                  icon={<Eye className="size-4" />}
                  size="small"
                  variant="secondary"
                  onClick={() => setPreviewContent(draft.content)}
                >
                  Предпросмотр
                </Button>
                <input
                  ref={markdownImageInputRef}
                  accept="image/*"
                  className="hidden"
                  type="file"
                  onChange={handleMarkdownImageUpload}
                />
              </div>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Полное описание Markdown
                </span>
                <textarea
                  ref={markdownTextareaRef}
                  autoFocus
                  className="min-h-80 w-full resize-y rounded-xl border border-input bg-surface px-3 py-3 font-mono text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary-muted"
                  placeholder={"## Заголовок\n\nПолное описание поста с **Markdown**."}
                  value={draft.content}
                  onChange={(event) => updateDraft("content", event.target.value)}
                />
              </label>

              {previewContent !== null && (
                <div className="rounded-xl border border-border bg-surface-muted p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Предпросмотр
                  </span>
                </div>
                <div className="max-h-[420px] overflow-y-auto pr-2">
                  {previewContent.trim() ? (
                    <MarkdownContent content={previewContent} />
                  ) : (
                    <p className="text-sm font-medium text-muted-foreground">
                      Markdown появится здесь после нажатия предпросмотра.
                    </p>
                  )}
                </div>
              </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}
        </form>
      </Modal>
    </>
  );
};
