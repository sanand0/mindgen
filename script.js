import { render, html } from "https://cdn.jsdelivr.net/npm/lit-html@3/+esm";
import { unsafeHTML } from "https://cdn.jsdelivr.net/npm/lit-html@3/directives/unsafe-html.js";
import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@2";
import { Marked } from "https://cdn.jsdelivr.net/npm/marked@16/+esm";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1";
import throttle from "https://cdn.jsdelivr.net/npm/lodash-es@4/throttle.js/+esm";
import { mindgen } from "./mindgen.js";

const DEFAULT_BASE_URLS = [
  "https://api.openai.com/v1",
  "https://aipipe.org/openai/v1",
  "https://llmfoundry.straivedemo.com/openai/v1",
  "https://llmfoundry.straive.com/openai/v1",
];

let selectedDemo = null; // number index into config.demos
let uploadedFile = null; // { filename: string, file_data: base64 } when upload selected
let config = null;

document.querySelector("#openai-config-btn").addEventListener("click", async () => {
  await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS, show: true });
});

saveform("#mindgen-settings", { exclude: '[type="file"]' });

const marked = new Marked();

function dataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// Load and render demos
const loading = html`<div class="spinner-border spinner-border-sm" role="status"></div>`;
const demosContainer = document.getElementById("demos");
render(loading, demosContainer);

function renderDemos() {
  const demosHtml = html`
    <div class="container mx-auto">
      <div class="row g-3">
        <!-- Upload card -->
        <div class="col-md-6 col-lg-4">
          <label for="upload-input" class="w-100 h-100 m-0">
            <div
              id="upload-card"
              class="card h-100 demo-card ${selectedDemo === "upload" ? "border-primary bg-primary bg-opacity-10" : ""}"
              title="Click to choose a file or drag-and-drop here"
            >
              <div class="card-body d-flex flex-column">
                <h5 class="card-title">Upload your file</h5>
                <p>Upload a PDF file under 5 MB. Click this card to pick a file, or drag and drop a file here.</p>
                <p>The file may contain text, tables, and images. The images will be analyzed visually and with OCR.</p>
                <div class="mt-auto d-flex justify-content-between align-items-center">
                  <div class="small text-body-secondary text-truncate">
                    ${uploadedFile ? uploadedFile.filename : "No file selected"}
                  </div>
                  ${selectedDemo === "upload" ? html`<i class="bi bi-check-circle-fill text-primary fs-4"></i>` : ""}
                </div>
              </div>
            </div>
          </label>
          <input id="upload-input" type="file" class="d-none" />
        </div>
        ${config.demos.map(
          (demo, index) => html`
            <div class="col-md-6 col-lg-4">
              <div
                class="card h-100 demo-card ${selectedDemo === index ? "border-primary bg-primary bg-opacity-10" : ""}"
                data-demo-index="${index}"
                style="cursor: pointer;"
              >
                <div class="card-body d-flex flex-column">
                  <h5 class="card-title">${demo.name}</h5>
                  <p>${demo.description}</p>
                  <div class="mt-auto d-flex justify-content-between align-items-center">
                    <div class="btn-group" role="group">
                      <button
                        type="button"
                        class="btn btn-outline-secondary btn-sm"
                        onclick="window.open('${demo.source}', '_blank')"
                        title="View PDF source"
                      >
                        <i class="bi bi-file-earmark-pdf"></i>
                      </button>
                      <button
                        type="button"
                        class="btn btn-outline-secondary btn-sm"
                        onclick="window.open('${demo.url}', '_blank')"
                        title="View text content"
                      >
                        <i class="bi bi-file-earmark-text"></i>
                      </button>
                    </div>
                    ${selectedDemo === index ? html`<i class="bi bi-check-circle-fill text-primary fs-4"></i>` : ""}
                  </div>
                </div>
              </div>
            </div>
          `,
        )}
      </div>
    </div>
  `;
  render(demosHtml, demosContainer);

  // Add click handlers for demo selection
  demosContainer.addEventListener("click", (e) => {
    const card = e.target.closest(".demo-card[data-demo-index]");
    if (card) {
      const index = parseInt(card.dataset.demoIndex);
      selectedDemo = index;
      renderDemos(); // Re-render to update selection
    }
  });

  // Wire up upload input change + drag/drop on the upload card
  const uploadInput = document.getElementById("upload-input");
  const uploadCard = document.getElementById("upload-card");

  async function handleChosenFile(file) {
    const maxBytes = 5 * 1024 * 1024;
    uploadedFile = null;
    if (selectedDemo === "upload") selectedDemo = null;
    if (!file) return;
    if (file.size > maxBytes || file.type !== "application/pdf") {
      bootstrapAlert({
        title: file.size > maxBytes ? "File too large" : "Not a PDF",
        body: "Upload a PDF under 5 MB",
        color: "warning",
      });
    } else {
      try {
        uploadedFile = { filename: file.name, file_data: await dataURL(file) };
        selectedDemo = "upload";
      } catch (err) {
        bootstrapAlert({ title: "Read error", body: String(err), color: "danger" });
      }
    }
    renderDemos();
  }

  if (uploadInput) {
    uploadInput.onchange = () => handleChosenFile(uploadInput.files?.[0]);
  }
  if (uploadCard) {
    uploadCard.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadCard.classList.add("border-primary");
    });
    uploadCard.addEventListener("dragleave", () => uploadCard.classList.remove("border-primary"));
    uploadCard.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadCard.classList.remove("border-primary");
      handleChosenFile(e.dataTransfer?.files?.[0]);
    });
  }
}

// Throttled renderer to avoid excessive updates while streaming
const draw = throttle((hier) => mindgen(hier, { container: "#mindgen" }), 1000, { leading: true, trailing: true });

// Global counter to assign incremental node IDs per render
let nodeIdCounter = 0;

// Convert marked list structure to D3 hierarchy
function processListItem(item) {
  // Extract text content from the list item
  let raw = "";
  if (item.tokens)
    for (const token of item.tokens)
      if (token.type === "paragraph" && token.tokens)
        raw = token.tokens
          .map((t) => t.raw || t.text || "")
          .join("")
          .trim();
      else if (token.type === "text") raw = token.text || token.raw || "";

  // Assign a sequential numeric ID (0, 1, 2, ...)
  const id = nodeIdCounter++;
  const htmlText = marked.parseInline(raw || "Untitled");
  const node = { id: `node-${nodeIdCounter}`, text: htmlText };
  // Check if this item has a nested list
  if (item.tokens) {
    const nestedList = item.tokens.find((token) => token.type === "list");
    if (nestedList && nestedList.items) node.children = nestedList.items.map(processListItem);
  }
  return node;
}

async function* llm(body) {
  const { apiKey, baseUrl } = await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS });
  const request = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, stream: true }),
  };
  if (apiKey) request.headers.Authorization = `Bearer ${apiKey}`;
  else request.credentials = "include";
  for await (const ev of asyncLLM(`${baseUrl}/chat/completions`, request)) yield ev;
}

const $btn = document.getElementById("generate-mindmap");
const $status = document.getElementById("generate-status");

$btn.addEventListener("click", async () => {
  // Check if a demo is selected
  if (selectedDemo === null) {
    bootstrapAlert({
      title: "No Demo Selected",
      body: "Please select a demo document to generate a mind map",
      color: "warning",
    });
    return;
  }

  const prompt = document.getElementById("mindgen-prompt").value.trim();
  if (!prompt) {
    bootstrapAlert({ title: "No Prompt", body: "Please enter a prompt for knowledge generation", color: "warning" });
    return;
  }

  $btn.disabled = true;
  render(loading, $status);

  try {
    let body;
    const model = document.getElementById("model").value;
    if (selectedDemo === "upload") {
      if (!uploadedFile) {
        throw new Error("No file selected for upload");
      }

      body = {
        model,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: [{ type: "file", file: uploadedFile }] },
        ],
      };
    } else {
      // Fetch the selected demo content
      const demo = config.demos[selectedDemo];
      const demoResponse = await fetch(demo.url);
      if (!demoResponse.ok) {
        throw new Error(`Failed to fetch demo content: ${demoResponse.statusText}`);
      }
      const demoContent = await demoResponse.text();
      body = {
        model,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: demoContent },
        ],
      };
    }

    const $response = document.getElementById("response");
    let hierarchy = { id: "root", text: "⭐" };
    for await (const { content } of llm(body, model)) {
      render(unsafeHTML(marked.parse(content ?? "")), $response);
      // Use the marked lexer to parse the content and find the first list and convert it into a D3 hierarchy
      const lexed = marked.lexer(content ?? "");

      // Find the first list in the lexed tokens
      const firstList = lexed.find((token) => token.type === "list");
      if (firstList) {
        // Create root node with list items as children
        nodeIdCounter = 0; // Reset IDs for each new hierarchy build
        hierarchy.children = firstList.items.map(processListItem);
        draw(hierarchy);
      }
    }

    draw(hierarchy); // Final draw to ensure complete rendering
  } catch (error) {
    console.error("Error generating mind map:", error);
    bootstrapAlert({ title: "Generation Error", body: error.message, color: "danger" });
  }

  render(null, $status);
  $btn.disabled = false;
});

// Initialize demos when page loads
try {
  const response = await fetch("config.json");
  config = await response.json();
  renderDemos();
} catch (error) {
  console.error("Error loading demos:", error);
  bootstrapAlert({ title: "Error", body: "Failed to load demo configuration", color: "danger" });
}
