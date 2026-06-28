import { Check, RefreshCw, Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  useAdminServersQuery,
  useApproveAdminServerMutation,
  useRejectAdminServerMutation,
  useUpdateAdminServerMutation,
} from "../model";
import type { AdminServerItem, AdminServerUpdatePayload } from "../types";
import { Button } from "../../../../shared/components/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../../shared/components/Card";
import { Input } from "../../../../shared/components/Input";

interface ModerationFormState {
  name: string;
  slogan: string;
  description: string;
  website: string;
  youtube: string;
  discord: string;
  telegram: string;
  vk: string;
  banner: string;
  logo: string;
  images: string;
  versions: string;
  categories: string;
  reviewComment: string;
}

function formatDate(value: string | null) {
  if (!value) {
    return "нет данных";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function joinLines(values: string[]) {
  return values.join("\n");
}

function splitLines(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildFormState(server: AdminServerItem): ModerationFormState {
  return {
    name: server.name,
    slogan: server.slogan ?? "",
    description: server.description ?? "",
    website: server.website ?? "",
    youtube: server.youtube ?? "",
    discord: server.discord ?? "",
    telegram: server.telegram ?? "",
    vk: server.vk ?? "",
    banner: server.bannerUrl ?? "",
    logo: server.logoUrl ?? "",
    images: joinLines(server.imageUrls),
    versions: joinLines(server.versions),
    categories: JSON.stringify(server.categories ?? {}, null, 2),
    reviewComment: "",
  };
}

function toNullable(value: string) {
  const text = value.trim();
  return text ? text : null;
}

function getMutationError(error: unknown) {
  return error instanceof Error ? error.message : null;
}

export const NewServersModeration = () => {
  const { data, error, isLoading, refetch, isFetching } = useAdminServersQuery();
  const updateMutation = useUpdateAdminServerMutation();
  const approveMutation = useApproveAdminServerMutation();
  const rejectMutation = useRejectAdminServerMutation();
  const servers = useMemo(() => data?.items ?? [], [data?.items]);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const selectedServer = servers.find((server) => server.id === selectedServerId) ?? servers[0] ?? null;
  const [formState, setFormState] = useState<ModerationFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedServer) {
      setSelectedServerId(null);
      setFormState(null);
      return;
    }

    setSelectedServerId(selectedServer.id);
    setFormState(buildFormState(selectedServer));
    setFormError(null);
  }, [selectedServer?.id]);

  const mutationError =
    getMutationError(updateMutation.error)
    ?? getMutationError(approveMutation.error)
    ?? getMutationError(rejectMutation.error)
    ?? formError;
  const isMutating = updateMutation.isPending || approveMutation.isPending || rejectMutation.isPending;

  const updateField = (field: keyof ModerationFormState, value: string) => {
    setFormState((current) => current ? { ...current, [field]: value } : current);
  };

  const buildPayload = (): AdminServerUpdatePayload | null => {
    if (!formState) {
      return null;
    }

    try {
      return {
        name: formState.name,
        slogan: toNullable(formState.slogan),
        description: toNullable(formState.description),
        website: toNullable(formState.website),
        youtube: toNullable(formState.youtube),
        discord: toNullable(formState.discord),
        telegram: toNullable(formState.telegram),
        vk: toNullable(formState.vk),
        banner: splitLines(formState.banner).slice(0, 1),
        logo: splitLines(formState.logo).slice(0, 1),
        images: splitLines(formState.images),
        versions: splitLines(formState.versions),
        categories: JSON.parse(formState.categories || "{}") as Record<string, unknown>,
      };
    } catch {
      setFormError("Категории должны быть валидным JSON-объектом");
      return null;
    }
  };

  const saveServer = async () => {
    if (!selectedServer) {
      return false;
    }

    setFormError(null);
    const payload = buildPayload();

    if (!payload) {
      return false;
    }

    await updateMutation.mutateAsync({ serverId: selectedServer.id, payload });
    return true;
  };

  const approveServer = async () => {
    if (!selectedServer) {
      return;
    }

    const saved = await saveServer();

    if (!saved) {
      return;
    }

    await approveMutation.mutateAsync({
      serverId: selectedServer.id,
      comment: formState?.reviewComment,
    });
  };

  const rejectServer = async () => {
    if (!selectedServer) {
      return;
    }

    await rejectMutation.mutateAsync({
      serverId: selectedServer.id,
      comment: formState?.reviewComment,
    });
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Управление: Сервера
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-foreground">Новые сервера</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Здесь появляются проекты, которые уже подтвердили владение через MOTD.
          </p>
        </div>
        <Button
          icon={<RefreshCw size={18} />}
          variant="secondary"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          Обновить
        </Button>
      </div>

      {(error || mutationError) && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error instanceof Error ? error.message : mutationError ?? "Не удалось загрузить новые сервера"}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Очередь</CardTitle>
            <CardDescription>
              {isLoading ? "Загружаем заявки" : `${servers.length} ожидает решения`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!isLoading && servers.length === 0 && (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Новых серверов пока нет
              </div>
            )}

            {servers.map((server) => (
              <button
                key={server.id}
                type="button"
                className={[
                  "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                  selectedServer?.id === server.id
                    ? "border-primary bg-primary-muted"
                    : "border-border bg-background hover:border-primary",
                ].join(" ")}
                onClick={() => setSelectedServerId(server.id)}
              >
                <span className="block text-sm font-bold text-foreground">{server.name}</span>
                <span className="mt-1 block text-xs font-semibold text-muted-foreground">
                  {server.ip}:{server.port}
                </span>
                <span className="mt-2 block text-xs text-muted-foreground">
                  MOTD: {formatDate(server.motdVerifiedAt)}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>

        {selectedServer && formState ? (
          <Card>
            <CardHeader>
              <CardTitle>{selectedServer.name}</CardTitle>
              <CardDescription>
                Владелец: {selectedServer.owner?.name ?? "не указан"} · Рейтинг: {selectedServer.rating}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Название"
                  value={formState.name}
                  onChange={(event) => updateField("name", event.target.value)}
                />
                <Input
                  label="Слоган"
                  value={formState.slogan}
                  onChange={(event) => updateField("slogan", event.target.value)}
                />
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Описание
                </span>
                <textarea
                  className="min-h-36 w-full rounded-xl border border-input bg-surface px-3 py-3 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary-muted"
                  value={formState.description}
                  onChange={(event) => updateField("description", event.target.value)}
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <Input label="Сайт" value={formState.website} onChange={(event) => updateField("website", event.target.value)} />
                <Input label="YouTube" value={formState.youtube} onChange={(event) => updateField("youtube", event.target.value)} />
                <Input label="Discord" value={formState.discord} onChange={(event) => updateField("discord", event.target.value)} />
                <Input label="Telegram" value={formState.telegram} onChange={(event) => updateField("telegram", event.target.value)} />
                <Input label="VK" value={formState.vk} onChange={(event) => updateField("vk", event.target.value)} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Input label="Баннер URL" value={formState.banner} onChange={(event) => updateField("banner", event.target.value)} />
                <Input label="Логотип URL" value={formState.logo} onChange={(event) => updateField("logo", event.target.value)} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Версии
                  </span>
                  <textarea
                    className="min-h-28 w-full rounded-xl border border-input bg-surface px-3 py-3 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary-muted"
                    value={formState.versions}
                    onChange={(event) => updateField("versions", event.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Изображения
                  </span>
                  <textarea
                    className="min-h-28 w-full rounded-xl border border-input bg-surface px-3 py-3 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary-muted"
                    value={formState.images}
                    onChange={(event) => updateField("images", event.target.value)}
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Категории JSON
                </span>
                <textarea
                  className="min-h-44 w-full rounded-xl border border-input bg-surface px-3 py-3 font-mono text-xs font-semibold text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary-muted"
                  value={formState.categories}
                  onChange={(event) => updateField("categories", event.target.value)}
                />
              </label>

              <div className="grid gap-4 rounded-xl border border-border bg-background px-4 py-4 md:grid-cols-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Статус</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {selectedServer.latestStatus?.isOnline ? "Онлайн" : "Оффлайн"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Игроки</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {selectedServer.latestStatus?.playersOnline ?? 0}/{selectedServer.latestStatus?.playersMax ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">MOTD</p>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">
                    {selectedServer.latestStatus?.motd ?? "нет данных"}
                  </p>
                </div>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Комментарий для владельца
                </span>
                <textarea
                  className="min-h-24 w-full rounded-xl border border-input bg-surface px-3 py-3 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary-muted"
                  placeholder="Причина отклонения или внутренний комментарий"
                  value={formState.reviewComment}
                  onChange={(event) => updateField("reviewComment", event.target.value)}
                />
              </label>
            </CardContent>

            <CardFooter className="flex-wrap justify-between">
              <div className="flex flex-wrap gap-2">
                <Button
                  icon={<Save size={18} />}
                  variant="secondary"
                  disabled={isMutating}
                  onClick={() => void saveServer()}
                >
                  Сохранить
                </Button>
                <Button
                  icon={<Check size={18} />}
                  disabled={isMutating}
                  onClick={() => void approveServer()}
                >
                  Принять
                </Button>
              </div>
              <Button
                icon={<X size={18} />}
                variant="tertiary"
                disabled={isMutating}
                onClick={() => void rejectServer()}
              >
                Отклонить
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <Card className="min-h-96 items-center justify-center text-center">
            <CardTitle>Выберите сервер</CardTitle>
            <CardDescription>Когда появятся новые заявки, их можно будет проверить здесь.</CardDescription>
          </Card>
        )}
      </div>
    </section>
  );
};
