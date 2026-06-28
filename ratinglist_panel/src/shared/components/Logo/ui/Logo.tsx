import { Link } from "react-router-dom";

export const Logo = () => {
  return (
    <Link
      to="/"
      aria-label="Astronix Monitoring, главная"
      className="relative inline-flex origin-left pr-14 text-foreground transition-transform duration-200 ease-out hover:scale-105"
    >
      <strong className="text-xl font-black uppercase leading-none tracking-[-0.06em] sm:text-2xl">
        Astronix
      </strong>
      <span className="absolute right-0 top-[-0.45rem] text-[0.55rem] font-bold uppercase tracking-[0.12em] text-primary sm:text-[0.6rem]">
        Monitoring
      </span>
    </Link>
  );
};
