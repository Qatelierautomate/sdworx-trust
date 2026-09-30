import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { COUNTRIES, CUSTOMER_TYPES, PRODUCTS } from "./hub-options";

const inputSchema = z.object({
  question: z.string().trim().min(3).max(700),
  language: z.enum(["English", "Nederlands", "Français", "Deutsch"]),
  country: z.enum(COUNTRIES),
  customerType: z.enum(CUSTOMER_TYPES),
  product: z.enum(PRODUCTS),
});

export const answerKnowledgeQuestion = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const { generateKnowledgeAnswer } = await import("./knowledge-answer.server.ts");
    return generateKnowledgeAnswer(data);
  });
