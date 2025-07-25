import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";
import { Express } from "express";

// Load base file and all referenced files
const loadYamlWithRefs = (filePath: string): any => {
  const base = YAML.load(filePath);

  // Recursively resolve $refs
  const resolveRefs = (obj: any): any => {
    if (obj && typeof obj === "object") {
      if (obj.$ref) {
        const refPath = path.join(path.dirname(filePath), obj.$ref);
        return YAML.load(refPath);
      }
      return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [key, resolveRefs(value)])
      );
    }
    return obj;
  };

  return resolveRefs(base);
};

export default (app: Express) => {
  const swaggerDocument = loadYamlWithRefs(
    path.join(__dirname, "../docs/openapi/openapi-base.yaml")
  );

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
};
