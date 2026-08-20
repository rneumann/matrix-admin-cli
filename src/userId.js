export function toFullUserId(idOrLocalpart, serverName) {
  return idOrLocalpart.startsWith('@') ? idOrLocalpart : `@${idOrLocalpart}:${serverName}`;
}
