// router.ts
import fs from "fs";
import path from "path";
export default async function router(app, routesPath = "routes", base = "") {
    const fullPath = path.join(process.cwd(), routesPath);
    for (const file of fs.readdirSync(fullPath)) {
        const fullFilePath = path.join(fullPath, file);
        const stat = fs.statSync(fullFilePath);
        if (stat.isDirectory()) {
            router(app, path.join(routesPath, file), path.join(base, file));
        }
        else {
            const [name, methodWithExt] = file.split(".");
            const method = methodWithExt.replace(".js", "").toLowerCase();
            let routePath = "/" + base + (name === "index" ? "" : "/" + name);
            routePath = routePath.replace(/\[([^\]]+)\]/g, ":$1");
            const handlerModule = await import(path.join("file://" + path.resolve(routesPath, file)));
            const handler = handlerModule.default || handlerModule;
            app[method](routePath, handler);
        }
    }
}
