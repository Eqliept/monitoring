import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { appRoutes } from "../config/routes";

const router = createBrowserRouter(appRoutes);

export const AppRouter = () => {
  return <RouterProvider router={router} />;
};
