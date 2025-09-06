# MindGen

**Create knowledge graphs and mind maps with LLMs**

🚀 **Live Demo:** [https://sanand0.github.io/mindgen/](https://sanand0.github.io/mindgen/)

## Overview

MindGen is an interactive web application that transforms complex documents into visual, hierarchical mind maps using Large Language Models (LLMs). It automatically analyzes documents and generates navigable knowledge graphs that highlight key insights, themes, and relationships.

## Features

- **AI-Powered Analysis**: Uses OpenAI GPT models to intelligently extract and organize document content
- **Interactive Visualization**: Drag-and-drop, collapsible mind maps with D3.js
- **Document Examples**: Pre-loaded with sustainability reports, RFPs, and regulatory guidelines
- **Customizable Prompts**: Modify the AI prompt to focus on specific aspects of documents
- **Real-time Generation**: Stream the mind map creation process as the AI generates content
- **Dark/Light Themes**: Built-in theme switching for comfortable viewing

## How It Works

1. **Select a Document**: Choose from curated examples including:

   - Amazon Sustainability Report 2024
   - IFS Sustainability Report 2024
   - Leon County Broadband RFP 2025
   - EBA ESG Guidelines 2025

2. **Configure Settings** (Optional):

   - Set up your OpenAI API key for enhanced performance
   - Customize the knowledge generation prompt
   - Select your preferred GPT model

3. **Generate**: Click the "Generate" button to create your mind map

4. **Explore**: Interact with the generated mind map:
   - Drag nodes to reorganize
   - Click nodes to expand/collapse sections
   - Navigate through the hierarchical structure

## Technical Stack

- **Frontend**: Vanilla JavaScript with modern ES modules
- **Visualization**: D3.js for interactive graphics
- **UI Framework**: Bootstrap 5 with custom styling
- **AI Integration**: OpenAI API with streaming support
- **Deployment**: GitHub Pages

## Getting Started

### Prerequisites

- A modern web browser
- OpenAI API key (optional but recommended for best performance)

### Local Development

1. Clone the repository:

   ```bash
   git clone https://github.com/sanand0/mindgen.git
   cd mindgen
   ```

2. Serve the files using a local web server:

   ```bash
   # Using Python
   python -m http.server 8000

   # Using Node.js
   npx serve .

   # Using any other static file server
   ```

3. Open your browser to `http://localhost:8000`

### Configuration

1. Click "Configure OpenAI" to set up your API key
2. Choose from available base URLs or use your own OpenAI-compatible endpoint
3. Adjust the knowledge generation prompt to focus on specific aspects
4. Select your preferred model (gpt-5-mini, gpt-4o, etc.)

## File Structure

```
mindgen/
├── index.html          # Main application interface
├── script.js           # Application logic and demo handling
├── mindgen.js          # Mind map visualization engine
├── mindgen.css         # Custom styles
├── config.json         # Demo document configurations
├── docs/               # Sample documents
│   ├── sustainability-amazon-2024.txt
│   ├── sustainability-ifs-2024.txt
│   ├── rfp-leon-county-2025.txt
│   └── esg-eba-2025.txt
└── README.md           # This file
```

## Customization

### Adding New Documents

1. Add your document as a text file in the `docs/` folder
2. Update `config.json` with your document's metadata:
   ```json
   {
     "name": "Your Document Title",
     "url": "docs/your-document.txt",
     "source": "https://original-pdf-url.com/doc.pdf",
     "description": "Brief description of the document content"
   }
   ```

### Modifying the AI Prompt

The default prompt focuses on creating hierarchical mind maps with:

- Maximum 3 levels deep
- Maximum 6 nodes per level
- 5-30 words per node
- Meaningful subtree summaries

Customize this in the "Advanced" settings to focus on specific aspects like:

- Key risks and opportunities
- Stakeholder perspectives
- Financial implications
- Technical specifications

## LICENSE

[MIT](LICENSE)
