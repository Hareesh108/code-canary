# Code Canary 🐤

> Your friendly, privacy-friendly AI coding companion. All AI runs locally in your browser with WebGPU acceleration.

---

**Code Canary** is a modern, privacy-friendly AI assistant for developers. Paste your code, ask questions, or chat in real time—right in your browser, powered by local LLMs and WebGPU acceleration. Designed for a beautiful, fast, and secure developer experience.

---

## 🚦 WebGPU Setup (Required for Local LLM)

> **Note:**
> For best results, enable the following Chrome flags for WebGPU development:
> Search : chrome://flags/
>
> - **Unsafe WebGPU Support**: Enables best-effort WebGPU support on unsupported configurations. Only use for your own development. May expose security issues.
>   - Go to: `chrome://flags/#enable-unsafe-webgpu`
>   - Set to: **Enabled**
>
> - **WebGPU Developer Features**: Enables web applications to access WebGPU features intended only for development.
>   - Go to: `chrome://flags/#enable-webgpu-developer-features`
>   - Set to: **Enabled**
>
> These are available on Mac, Windows, Linux, ChromeOS, and Android.

---

## ✨ Features

- **Answer Mode:** Paste code and ask a question, get a single, focused answer.
- **Chatbot Mode:** Multi-turn, streaming chat with code context and history.
- **Modern UI:** Beautiful yellow/gold theme, dark mode, and responsive design.
- **Drag & Drop:** Instantly add code by dragging files into the chat.
- **Local & Private:** All AI runs in your browser—no code or questions leave your device.
- **WebGPU Acceleration:** Fast, hardware-accelerated LLM inference (see setup above).

---

## 🚀 Getting Started

1. **Install dependencies:**

   ```bash
   npm install
   # or
   yarn install
   ```

2. **Run the development server:**

   ```bash
   npm run dev
   # or
   yarn dev
   ```

3. **Open your browser:**
   - Go to [http://localhost:3000](http://localhost:3000)
   - Make sure you have enabled the required WebGPU flags (see above)

---

## 🛠 Usage

- **Switch modes** at the top: "Answer" for single Q&A, "Chatbot" for conversation.
- **Paste or drag code** into the input area.
- **Ask questions** about your code, or chat naturally.
- **See answers stream in real time** (in Chatbot mode).
- **All processing is local**—your code and questions stay private.

---

## 📁 Project Structure

- `src/app/page.tsx` — Main UI and logic
- `public/` — Static assets (add your logo here!)
- `package.json` — Project dependencies

---

## 🙏 Credits

- Built with [Next.js](https://nextjs.org), [@mlc-ai/web-llm](https://github.com/mlc-ai/web-llm), and [Tailwind CSS](https://tailwindcss.com/).
- Inspired by the open-source AI and developer tools community.

---

## 📢 Feedback & Contributions

We welcome feedback, issues, and contributions! Please open an issue or PR.

---
