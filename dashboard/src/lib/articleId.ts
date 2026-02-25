export function articleDisplayId(project: string, id: number): string {
  const prefix =
    project === 'nakupsrebra'
      ? 'NAK'
      : project === 'baseman-blog'
        ? 'BAS'
        : project === 'avant2go-subscribe'
          ? 'A2G'
          : 'ART';

  return `${prefix}-${String(id).padStart(3, '0')}`;
}
