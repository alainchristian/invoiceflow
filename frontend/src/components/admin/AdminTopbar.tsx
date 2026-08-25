import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Search, Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/DropdownMenu";

export function AdminTopbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (query.trim()) navigate(`/admin/tenants?search=${encodeURIComponent(query.trim())}`);
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 sm:px-6">
      <button onClick={onMenuClick} className="rounded-md p-2 text-fg-secondary hover:bg-surface-hover hover:text-fg lg:hidden">
        <Menu className="h-5 w-5" />
      </button>
      <form onSubmit={handleSubmit} className="flex min-w-0 max-w-sm flex-1 items-center gap-2 text-fg-muted">
        <Search className="h-4 w-4 shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tenants, users..."
          className="w-full bg-transparent text-sm text-fg placeholder:text-fg-muted focus:outline-none"
        />
      </form>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-md p-2 text-fg-secondary hover:bg-surface-hover hover:text-fg">
            {resolvedTheme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => setTheme("light")}>
            <Sun className="mr-2 h-4 w-4" /> Light {theme === "light" && "✓"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("dark")}>
            <Moon className="mr-2 h-4 w-4" /> Dark {theme === "dark" && "✓"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("system")}>
            <Monitor className="mr-2 h-4 w-4" /> System {theme === "system" && "✓"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
