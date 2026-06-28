import type { SideBarCategoryData } from "../../../shared/components/SideBarCategory";

export const sidebarCategories: SideBarCategoryData[] = [
  {
    id: "workspace",
    name: "Мониторинг",
    variant: "normal",
    items: [
      {
        id: "dashboard",
        name: "Обзор",
        icon: "dashboard",
        href: "/",
      },
    ],
  },
  {
    id: "management",
    name: "Управление: Пользователи",
    variant: "normal",
    items: [
      {
        id: "users",
        name: "Пользователи",
        icon: "users",
        href: "/users",
      },
      {
        id: "chats",
        name: "Чаты",
        icon: "users",
        href: "/chats"
      },
      {
        id: "blocks",
        name: "Блокировки",
        icon: "users",
        href: "/blocks"
      },
      {
        id: "reports",
        name: "Жалобы",
        icon: "users",
        href: "/reports"
      }
    ],
  },
    {
      id: "management",
      name: "Управление: Сервера",
      variant: "normal",
      items: [
        {
          id: "servers",
          name: "Сервера",
          icon: "users",
          href: "/servers"
        },
        {
          id: "new_servers",
          name: "Новые сервера",
          icon: "users",
          href: "/new_servers"
        },
        {
          id: "server_reports",
          name: "Жалобы",
          icon: "users",
          href: "/server_reports"
        }
      ],
    },
    {
    id: "content",
    name: "Контент",
    variant: "normal",
    items: [
      {
        id: "categories",
        name: "Категории",
        icon: "users",
        href: "/categories",
      },
      {
        id: "Blog",
        name: "Блог",
        icon: "users",
        href: "/blog",
      }
    ],
  },
  {
    id: "roles",
    name: "Роли",
    variant: "normal",
    items: [
      {
        id: "roles",
        name: "Роли",
        icon: "users",
        href: "/roles",
      },
    ],
  }
];
