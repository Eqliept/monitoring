import { Link } from "react-router-dom";

export const NotFoundPage = () => {
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Ошибка 404</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Страница не найдена</h1>
      <Link
        to="/"
        className="mt-7 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        На главную
      </Link>
    </section>
  );
};
