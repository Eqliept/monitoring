import type {
  SideBarCategoryVariant,
  SideBarItemData,
} from "../../SideBarItem";

export interface SideBarCategoryData {
  id: string;
  name: string;
  variant: SideBarCategoryVariant;
  items: SideBarItemData[];
}

export interface SideBarCategoryProps {
  category: SideBarCategoryData;
}
