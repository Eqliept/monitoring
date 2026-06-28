export interface BlogPost {
  id: string;
  title: string;
  imageUrl: string;
  summary: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  views: number;
}

export interface BlogPostDraft {
  title: string;
  imageUrl: string;
  summary: string;
  content: string;
}
