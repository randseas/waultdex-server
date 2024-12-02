import fs from "fs";
import path from "path";

export class JsonDatabase {
  private dbPath: string;
  constructor() {
    this.dbPath = path.join(__dirname, "./data.json");
  }
  init() {
    if (!fs.existsSync(this.dbPath)) {
      const initialData: any = [];
      fs.writeFileSync(
        this.dbPath,
        JSON.stringify(initialData, null, 2),
        "utf8"
      );
    }
  }
  push(data: any) {
    const existingData = this.get();
    existingData.push(data);
    this.save(existingData);
  }
  get(): any[] {
    if (fs.existsSync(this.dbPath)) {
      return JSON.parse(fs.readFileSync(this.dbPath, "utf8"));
    } else {
      throw new Error("Database does not exist.");
    }
  }
  save(data: any[]) {
    fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2), "utf8");
  }
  set(key: string, value: any) {
    const allData = this.get();
    this.updateNestedValue(allData, key.split("."), value);
    this.save(allData);
  }
  deleteKey(key: string) {
    const allData = this.get();
    this.deleteNestedKey(allData, key.split("."));
    this.save(allData);
  }
  findOne(predicate: (item: any) => boolean): any | null {
    const data = this.get();
    return data.find(predicate) || null;
  }
  findAndUpdateOne(
    predicate: (item: any) => boolean,
    update: (item: any) => any
  ): boolean {
    const allData = this.get();
    let updated = false;
    const index = allData.findIndex(predicate);
    if (index !== -1) {
      allData[index] = update(allData[index]);
      this.save(allData);
      updated = true;
    }
    return updated;
  }
  private updateNestedValue(obj: any, keys: string[], value: any) {
    const lastKey = keys.pop();
    const lastObj = keys.reduce((o, key) => (o[key] = o[key] || {}), obj);
    lastObj[lastKey!] = value;
  }
  private deleteNestedKey(obj: any, keys: string[]) {
    const lastKey = keys.pop();
    const lastObj = keys.reduce((o, key) => (o[key] = o[key] || {}), obj);
    delete lastObj[lastKey!];
  }
}
