export interface CommentAuthorRef {
  _id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface Comment {
  _id: string;
  video: string;
  parent: string | null;
  author: CommentAuthorRef | null;
  body: string;
  isEdited: boolean;
  isDeleted: boolean;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
}
