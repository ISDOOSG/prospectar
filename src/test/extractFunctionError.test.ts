import { describe, it, expect } from "vitest";
import { extractFunctionError } from "@/hooks/useSettings";

describe("extractFunctionError", () => {
  it("uses the JSON body error message from the response context", async () => {
    const err = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      context: new Response(JSON.stringify({ error: "Apollo: chave inválida ou sem permissão" }), { status: 400 }),
    });
    const result = await extractFunctionError(err);
    expect(result.message).toBe("Apollo: chave inválida ou sem permissão");
  });

  it("falls back to the generic message when there is no context", async () => {
    const result = await extractFunctionError(new Error("Edge Function returned a non-2xx status code"));
    expect(result.message).toBe("Edge Function returned a non-2xx status code");
  });
});
