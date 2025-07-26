import swaggerUi from "swagger-ui-express";
import SwaggerParser from "@apidevtools/swagger-parser";
import path from "path";
import { Express } from "express";

export default async (app: Express) => {
  const apiPath = path.join(__dirname, "../docs/openapi/openapi-base.yaml");

  try {
    const swaggerDocument = await SwaggerParser.bundle(apiPath); // or .dereference(apiPath)
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  } catch (err) {
    console.error("❌ Failed to load Swagger:", err);
  }
};
