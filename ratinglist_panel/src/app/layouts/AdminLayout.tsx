import { Outlet } from "react-router-dom";
import { Header } from "../../widgets/Header";
import { SideBar, sidebarCategories } from "../../widgets/SideBar";

export const AdminLayout = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <div className="mx-auto flex w-full max-w-[1600px] flex-col lg:flex-row">
        <SideBar categories={sidebarCategories} />
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
