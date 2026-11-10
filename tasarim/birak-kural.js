export const BIRAK_SINIR=2e4;export function metinSurukleniyor(t){const n=[...t||[]];return!n.includes("Files")&&(n.includes("text/plain")||n.includes("text"))}export function birakilanMetin(t){const n=String(t||"").replace(/\r\n?/g,`
`).trim();return n?n.slice(0,2e4):null}
