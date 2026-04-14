import { defineConfig } from "vitepress";

export default defineConfig({
  title: "vlm-code-context-mcp",
  description: "AI-powered virtual IT department — codebase intelligence, 7-agent scrum team, sprint management, and React dashboard",
  ignoreDeadLinks: [/^http:\/\/localhost/, /ux-user-journey-map/],
  appearance: "dark",
  head: [
    ["link", { rel: "preconnect", href: "https://cdn.jsdelivr.net" }],
  ],
  themeConfig: {
    siteTitle: "vlm-code-context-mcp",
    nav: [
      { text: "Home", link: "/" },
      { text: "Guide", link: "/guide/" },
      { text: "Code Tools", link: "/tools/" },
      { text: "Scrum Tools", link: "/scrum/" },
      { text: "Dashboard", link: "/dashboard" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting Started", link: "/guide/" },
          { text: "Architecture", link: "/guide/architecture" },
        ],
      },
      {
        text: "Code Intelligence Tools",
        items: [
          { text: "Overview", link: "/tools/" },
          { text: "index_directory", link: "/tools/index-directory" },
          { text: "find_symbol", link: "/tools/find-symbol" },
          { text: "get_file_context", link: "/tools/get-file-context" },
          { text: "set_description", link: "/tools/set-description" },
          { text: "set_directory_description", link: "/tools/set-directory-description" },
          { text: "get_changes", link: "/tools/get-changes" },
          { text: "search_files", link: "/tools/search-files" },
          { text: "query / execute", link: "/tools/query-execute" },
        ],
      },
      {
        text: "Scrum Tools",
        items: [
          { text: "Overview", link: "/scrum/" },
          { text: "Sprint Lifecycle", link: "/scrum/sprints" },
          { text: "Tickets & Epics", link: "/scrum/tickets" },
          { text: "Milestones & Discovery", link: "/scrum/milestones" },
          { text: "Retro & Analytics", link: "/scrum/retro" },
          { text: "Agents & Team", link: "/scrum/agents" },
        ],
      },
      {
        text: "Dashboard",
        items: [
          { text: "Overview & Setup", link: "/dashboard" },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/VelimirMueller/mcp-server" },
    ],
    footer: {
      message: "MIT Licensed — Built by Velimir Mueller",
      copyright: "vlm-code-context-mcp v1.0.0",
    },
  },
});
