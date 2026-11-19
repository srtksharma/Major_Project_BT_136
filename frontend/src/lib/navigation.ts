/** Primary navigation — shared by the Navbar (client) and Footer (server). */
export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/scan", label: "Scan" },
  { href: "/batch", label: "Batch" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/about", label: "About" },
] as const;
