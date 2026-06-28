import type { BlogPost } from "../../../../entities/Blog";

export interface BlogCardProps {
  post: BlogPost;
  onDeleteClick: (post: BlogPost) => void;
  onDetailsClick: (post: BlogPost) => void;
  onEditClick: (post: BlogPost) => void;
}
