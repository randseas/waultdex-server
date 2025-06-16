import { v4 as createUUIDv4 } from "uuid";

export default function createcreateUUID() {
  return Math.random().toString(36).substring(2, 10);
}
export function createOTPCode() {
  return createUUIDv4().replace(/-/g, "").substring(0, 6);
}
