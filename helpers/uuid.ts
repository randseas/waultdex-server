import { v4 as uuidv4 } from "uuid";

export default function UUID() {
  const result = uuidv4().replace("-", "");
  console.log(result);
  return result;
}
