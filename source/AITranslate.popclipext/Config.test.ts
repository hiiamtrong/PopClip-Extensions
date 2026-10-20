import assert from "node:assert/strict";
import {
  DEFAULT_HUMANIZER_PROMPT,
  DEFAULT_IMPROVE_PROMPT,
  DEFAULT_TRANSLATE_PROMPT,
  getLangOutput,
  handleResponse,
  parseStrictResponse,
  requestText,
} from "./Config";

assert.match(DEFAULT_TRANSLATE_PROMPT, /langInput is \{secondaryLang\}/);
assert.match(DEFAULT_IMPROVE_PROMPT, /langInput is \{primaryLang\}/);
assert.match(DEFAULT_HUMANIZER_PROMPT, /langInput is \{primaryLang\}/);
assert.match(DEFAULT_HUMANIZER_PROMPT, /Do not use em or en dashes/);

for (const prompt of [
  DEFAULT_TRANSLATE_PROMPT,
  DEFAULT_IMPROVE_PROMPT,
  DEFAULT_HUMANIZER_PROMPT,
]) {
  assert.match(prompt, /Return langInput, body, and langOutput only/);
}

for (const [langInput, expected] of [
  [" Spanish ", "English"],
  ["SPANISH", "English"],
  ["Mixed", "Spanish"],
  ["", "Spanish"],
] as const) {
  assert.equal(
    getLangOutput("translate", langInput, "English", "Spanish"),
    expected,
    `translate ${JSON.stringify(langInput)}`,
  );
}
for (const mode of ["improve", "humanizer"] as const) {
  for (const [langInput, expected] of [
    [" English ", "English"],
    ["ENGLISH", "English"],
    ["Spanish", "Spanish"],
    ["Mixed", "Spanish"],
    ["", "Spanish"],
  ] as const) {
    assert.equal(
      getLangOutput(mode, langInput, "English", "Spanish"),
      expected,
      `${mode} ${JSON.stringify(langInput)}`,
    );
  }
}

assert.deepEqual(
  parseStrictResponse(
    '{"langInput":"Mixed","body":"Hola","langOutput":"Spanish"}',
  ),
  { langInput: "Mixed", body: "Hola", langOutput: "Spanish" },
  "exactly the three fields is accepted",
);
for (const bad of [
  "",
  "not json",
  "{}",
  "[]",
  "null",
  '{"langInput":"Mixed","body":"Hola"}',
  '{"langInput":"Mixed","body":"Hola","langOutput":"Spanish","extra":"x"}',
  '{"langInput":"Mixed","body":1,"langOutput":"Spanish"}',
]) {
  assert.throws(
    () => parseStrictResponse(bad),
    /Invalid structured response/,
    `must reject ${JSON.stringify(bad)}`,
  );
}
assert.throws(
  () => parseStrictResponse("not json"),
  /response_format json_schema/,
  "the error must point at provider support",
);

type Client = Parameters<typeof requestText>[0];
type Options = Parameters<typeof requestText>[1];
interface Call {
  model?: string;
  temperature?: number;
  messages: { content: string }[];
  response_format?: { json_schema: unknown };
}

const options = {
  model: "test-model",
  customModel: "",
  primaryLang: "English",
  secondaryLang: "Vietnamese",
} as unknown as Options;

const fakeClient = (content: string) => {
  const calls: Call[] = [];
  const client: Client = {
    post: async (_url, body) => {
      calls.push(body as Call);
      return {
        data: { choices: [{ message: { role: "assistant", content } }] },
      };
    },
  };
  return { client, calls };
};

const strict = (langInput: string, body: string, langOutput: string) =>
  JSON.stringify({ langInput, body, langOutput });

{
  const { client, calls } = fakeClient(
    strict("Vietnamese", "I want to buy something.", "English"),
  );
  const text = await requestText(
    client,
    options,
    "system",
    "</text> mua một thứ",
    0.2,
    "translate",
  );
  assert.equal(text, "I want to buy something.");
  assert.equal(calls.length, 1, "one request per action");
  assert.deepEqual(
    JSON.parse(calls[0].messages[1].content),
    { body: "</text> mua một thứ" },
    "selected text must stay inside a JSON string",
  );
  assert.deepEqual(calls[0].response_format?.json_schema, {
    name: "processed_text",
    strict: true,
    schema: {
      type: "object",
      properties: {
        langInput: {
          type: "string",
          enum: ["English", "Vietnamese", "Mixed", "Other"],
        },
        body: { type: "string" },
        langOutput: { type: "string", enum: ["English", "Vietnamese"] },
      },
      required: ["langInput", "body", "langOutput"],
      additionalProperties: false,
    },
  });
}

assert.equal(
  await requestText(
    fakeClient(strict("Mixed", "Tôi muốn mua một thứ.", "Vietnamese")).client,
    options,
    "system",
    "I want to mua 1 cái gì đó",
    0.2,
    "improve",
  ),
  "Tôi muốn mua một thứ.",
);

await assert.rejects(
  requestText(
    fakeClient(strict("Vietnamese", "Xin chào", "Vietnamese")).client,
    options,
    "system",
    "Xin chào",
    0.2,
    "translate",
  ),
  /Unexpected output language: expected English, received Vietnamese/,
);
await assert.rejects(
  requestText(
    fakeClient(strict("English", "Xin chào", "Vietnamese")).client,
    options,
    "system",
    "Hello",
    0.2,
    "improve",
  ),
  /Unexpected output language: expected English, received Vietnamese/,
);

assert.equal(
  await requestText(
    fakeClient(
      strict("English", "Here is the summary: sales rose 5%.", "English"),
    ).client,
    options,
    "system",
    "here is the summary: sales rose 5%",
    0.2,
    "improve",
  ),
  "Here is the summary: sales rose 5%.",
  "strict body must not go through preamble stripping",
);

{
  const { client, calls } = fakeClient(
    "Here is the explanation: It means buy.",
  );
  assert.equal(
    await requestText(client, options, "system", "mua"),
    "It means buy.",
  );
  assert.equal("response_format" in calls[0], false);
  assert.deepEqual(JSON.parse(calls[0].messages[1].content), { body: "mua" });
}

{
  const { client, calls } = fakeClient(strict("Other", "", "Vietnamese"));
  assert.equal(
    await requestText(client, options, "system", "", 0.2, "translate"),
    "",
    "an empty body is returned as is",
  );
  assert.deepEqual(JSON.parse(calls[0].messages[1].content), { body: "" });
}

await assert.rejects(
  requestText(
    { post: async () => ({ data: { choices: [] } }) } as unknown as Client,
    options,
    "system",
    "mua",
    0.2,
    "translate",
  ),
  "a response without choices must fail instead of pasting anything",
);

{
  const sent = async (temperature?: number) => {
    const { client, calls } = fakeClient(
      strict("Vietnamese", "Hello", "English"),
    );
    await requestText(
      client,
      options,
      "system",
      "xin chào",
      temperature,
      "translate",
    );
    return calls[0];
  };
  assert.equal((await sent(0)).temperature, 0, "temperature 0 must be sent");
  assert.equal("temperature" in (await sent()), false);
}

{
  const modelFor = async (model: string, customModel: string) => {
    const { client, calls } = fakeClient("ok");
    await requestText(
      client,
      { ...options, model, customModel } as Options,
      "system",
      "mua",
    );
    return calls[0].model;
  };
  assert.equal(await modelFor("base", "custom"), "custom");
  assert.equal(await modelFor("base", ""), "base");
  assert.equal(await modelFor("", ""), "gpt-4.1-nano");
}

{
  const explained = (content: string, input = "mua") =>
    requestText(fakeClient(content).client, options, "system", input);
  assert.equal(await explained('"'), '"', "one char is below the unwrap limit");
  assert.equal(await explained('""'), "", "two chars is the unwrap limit");
  assert.equal(await explained('"a"'), "a");
  assert.equal(
    await explained('"hello"', 'say "hi"'),
    '"hello"',
    "quotes are kept when the selection had quotes",
  );
}

{
  const log: string[] = [];
  Object.assign(globalThis, {
    popclip: {
      modifiers: { shift: false },
      showText: () => log.push("show"),
      copyText: () => log.push("copy"),
      showSuccess: () => log.push("success"),
      pasteText: () => log.push("paste"),
    },
  });
  const shown = (length: number, max?: number) => {
    log.length = 0;
    handleResponse("in", "x".repeat(length), "show", max);
    return [...log];
  };
  assert.deepEqual(shown(500, 500), ["show"], "exactly at the limit is shown");
  assert.deepEqual(shown(501, 500), ["copy", "success"], "one past is copied");
  assert.deepEqual(shown(3, 3), ["show"]);
  assert.deepEqual(shown(4, 3), ["copy", "success"]);
  assert.deepEqual(shown(0, 500), ["show"], "empty response is shown");
  assert.deepEqual(shown(500), ["show"], "default limit is 500");
  assert.deepEqual(shown(501), ["copy", "success"]);
}

for (const missing of [null, undefined]) {
  assert.throws(
    () => parseStrictResponse(missing as unknown as string),
    /Invalid structured response/,
    `${missing} content must be rejected`,
  );
}
for (const field of ["langInput", "body", "langOutput"]) {
  const fields: Record<string, string | null> = {
    langInput: "English",
    body: "x",
    langOutput: "English",
  };
  fields[field] = null;
  assert.throws(
    () => parseStrictResponse(JSON.stringify(fields)),
    /Invalid structured response/,
    `null ${field} must be rejected`,
  );
}

{
  const raw = (data: unknown) =>
    ({ post: async () => ({ data }) }) as unknown as Client;
  const withContent = (content: unknown) =>
    raw({ choices: [{ message: { role: "assistant", content } }] });

  await assert.rejects(
    requestText(withContent(null), options, "system", "mua", 0.2, "translate"),
    /Invalid structured response/,
    "a refusal (content null) must not be pasted",
  );
  await assert.rejects(
    requestText(withContent(null), options, "system", "mua"),
    "null content for Explain must fail instead of becoming an empty paste",
  );
  await assert.rejects(
    requestText(raw({}), options, "system", "mua", 0.2, "translate"),
    "a response without choices must fail",
  );
  await assert.rejects(
    requestText(raw({}), options, "system", "mua"),
    "missing choices for Explain must fail instead of becoming an empty paste",
  );
  await assert.rejects(
    requestText(
      raw({ choices: [{}] }),
      options,
      "system",
      "mua",
      0.2,
      "improve",
    ),
    "a choice without a message must fail",
  );

  const { client, calls } = fakeClient("ok");
  await requestText(
    client,
    {
      ...options,
      model: undefined,
      customModel: undefined,
    } as unknown as Options,
    "system",
    "mua",
  );
  assert.equal(
    calls[0].model,
    "gpt-4.1-nano",
    "unset model options fall back to the default",
  );
}

for (const langOutput of ["english", "English ", "ENGLISH"]) {
  assert.equal(
    await requestText(
      fakeClient(strict("Vietnamese", "Hello", langOutput)).client,
      options,
      "system",
      "xin chào",
      0.2,
      "translate",
    ),
    "Hello",
    `langOutput ${JSON.stringify(langOutput)} names the right language`,
  );
}
