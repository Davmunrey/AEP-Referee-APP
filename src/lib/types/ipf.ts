export interface AssignValidation {
  ok: boolean;
  error?: string;
  /**
   * El conflicto puede forzarse marcando el puesto como compartido (*).
   * `false`/ausente en bloqueos duros (slot inválido, mismo puesto duplicado).
   */
  overridable?: boolean;
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
