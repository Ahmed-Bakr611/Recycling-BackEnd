import swaggerJsdoc from "swagger-jsdoc";
// import swaggerUi from "swagger-ui-express";

// const options = {
//   definition: {
//     openapi: "3.0.0",
//     info: {
//       title: "Recycling System API",
//       version: "1.0.0",
//       description:
//         "API documentation for your Node.js + MongoDB recycling system",
//     },
//     servers: [
//       {
//         url: "http://localhost:5000/api",
//       },
//     ],
//   },
//   apis: ["src/routes/*.ts", "src/controllers/*.ts"], // adjust paths to your files
// };

// const swaggerSpec = swaggerJsdoc(options);
// src/swagger.ts
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";
import { Express } from "express";

const swaggerDocument = YAML.load(path.join(__dirname, "../../openapi.yaml"));

export default (app: Express) => {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
};

export { swaggerUi };
