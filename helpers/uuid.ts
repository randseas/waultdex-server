import { v4 as uuidv4 } from "uuid";

export default function UUID() {
  const result = uuidv4().split("-")[3].trim();
  return result;
}
