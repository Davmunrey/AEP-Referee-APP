export interface AssignValidation {
  ok: boolean;
  error?: string;
}

export interface IpfArticle {
  num: string;
  title?: string;
  text: string;
}

export interface IpfChapter {
  num: string;
  title: string;
  articles: IpfArticle[];
}
