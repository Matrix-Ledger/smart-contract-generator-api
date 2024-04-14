import {
  GenezioDeploy,
  GenezioHttpRequest,
  GenezioHttpResponse,
} from "@genezio/types";
import multipart from "parse-multipart-data";
import axios from "axios";
import "dotenv/config";
import { promises as fs } from "fs";

async function readRustTemplate(filePath: string): Promise<string> {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return data;
  } catch (error) {
    console.error("Failed to read file:", error);
    throw error; // Re-throw the error for caller to handle
  }
}

@GenezioDeploy({ type: "http" })
export class SmartContractGeneratorApi {
  /**
   * Generate Rust code based on a given description and contract details.
   */
  async generateRust(
    request: GenezioHttpRequest
  ): Promise<GenezioHttpResponse> {
    try {
      // const { description, contractType = 'generic', shardTarget = 'single', functionalRequirements = [], uploadedRustContent = '' } = request.body;
      const { description, language } = request.body;
      const rustTemplate = await readRustTemplate("adder.rs");

      // Convert the list of functional requirements into a string
      // const requirementsStr = functionalRequirements.join(', ');

      // Create the prompt for the AI model
      // const prompt = `Convert the following TypeScript description to Rust for a ${contractType} type, ${shardTarget} shard smart contract with the following functionalities: ${requirementsStr}. Description: ${description}. Existing Rust code: ${uploadedRustContent}. Note: instead of elrond_wasm, it will be multiversx_sc.`;
      const prompt = `This is a description for a new smart contract: ${description}.
      This is a template for a smart contract from MultiversX blockchain: ${rustTemplate}.
      Use them to generate a new smart contract in ${language}.
      Provide only the ${language} code.`;

      // Call GPT-4 to generate Rust code
      const headers = {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      };
      const data = {
        messages: [{ role: "user", content: prompt }],
        model: "gpt-4-0314",
      };
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        data,
        { headers }
      );

      if (response.status === 200) {
        const fullResponse = response.data.choices[0].message.content;

        // Extract only TypeScript code using a regular expression

        var code = null;
        var languageLC = language.toLowerCase();

        if (languageLC === "rust") {
          const codeMatch = /```rust([\s\S]*?)```/.exec(fullResponse);
          code = codeMatch ? codeMatch[1].trim() : null;
        } else if (languageLC === "typescript") {
          const codeMatch = /```typescript([\s\S]*?)```/.exec(fullResponse);
          code = codeMatch ? codeMatch[1].trim() : null;
        }

        if (code) {
          return { body: { code }, statusCode: "200" };
        } else {
          return {
            body: { error: `No ${language} code generated.` },
            statusCode: "500",
          };
        }
      } else {
        console.error(`OpenAI API Error: ${response.data}`);
        return {
          body: { error: `Error generating ${language} code.` },
          statusCode: "500",
        };
      }
    } catch (e) {
      console.error(`Error: ${e}`);
      return { body: { error: "Internal Server Error" }, statusCode: "500" };
    }
  }

  /**
   * Method that handles a simple HTTP request which receives a payload in the body and returns the same payload as plain text.
   *
   * @param {*} request
   * @returns
   */
  handleSimpleTextRequest(request: GenezioHttpRequest): GenezioHttpResponse {
    console.log(
      `Request received with simple text ${JSON.stringify(request.body)}!`
    );

    const uint8: Uint8Array = new Uint8Array(2);

    const response: GenezioHttpResponse = {
      body: request.body,
      headers: { "content-type": "text/html" },
      statusCode: "200",
    };

    return response;
  }

  /**
   * Method that handles a simple HTTP request which receives a JSON payload in the body and returns the same payload as JSON.
   */
  handleJsonBody(request: GenezioHttpRequest): GenezioHttpResponse {
    console.log(`Request received with body ${request.body}!`);
    if (!request.body.name) {
      throw Error("Missing parameter name");
    }

    const name = request.body.name;

    const response: GenezioHttpResponse = {
      body: {
        name,
      },
      headers: {
        testHeader: "testHeaderValue",
        statusDescription: "Ok",
      },
      statusCode: "201",
    };

    return response;
  }

  /**
   * Method that handles a simple HTTP request with query parameters and returns "Ok".
   */
  handleQueryParams(request: GenezioHttpRequest): GenezioHttpResponse {
    console.log(
      `Request received with query params ${request.queryStringParameters}!`
    );
    if (!request.queryStringParameters!.name) {
      throw Error("Missing parameter name");
    }

    const response: GenezioHttpResponse = {
      body: "Ok",
      headers: { "content-type": "text/html" },
      statusCode: "200",
    };

    return response;
  }

  /**
   * Method that receives a file using multipart and returns the file as binary.
   */
  handleMultipartData(request: GenezioHttpRequest): GenezioHttpResponse {
    console.log("Request receive with multipart data", request);

    const entries = multipart.parse(
      request.body,
      multipart.getBoundary(request.headers["content-type"])
    );

    const file = entries.find((entry): boolean => entry.name === "myFile");

    if (!file) {
      throw new Error("File not found!");
    }

    const response: GenezioHttpResponse = {
      body: file.data,
      isBase64Encoded: true,
      headers: { "content-type": "application/octet-stream" },
      statusCode: "200",
    };

    return response;
  }
}
