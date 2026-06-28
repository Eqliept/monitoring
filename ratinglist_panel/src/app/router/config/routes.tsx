import type { RouteObject } from "react-router-dom";
import { AdminLayout } from "../../layouts/AdminLayout";
import { DashboardPage } from "../../../pages/Main";
import { CategoriesPage } from "../../../pages/Categories";
import { BlogPage } from "../../../pages/Blog";
import { NewServersPage } from "../../../pages/NewServers";
import { NotFoundPage } from "../../../pages/NotFound";

export const appRoutes: RouteObject[] = [
  {
    path: "/",
    element: <AdminLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "categories",
        element: <CategoriesPage />,
      },
      {
        path: "blog",
        element: <BlogPage />,
      },
      {
        path: "new_servers",
        element: <NewServersPage />,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
];
