const KEY = "orbita.client_id";
function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : r & 3 | 8).toString(16);
  });
}
function getClientId() {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(KEY, id);
  }
  return id;
}
const newOpId = uuid;

export { getClientId, newOpId };
