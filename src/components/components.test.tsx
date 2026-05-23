// @vitest-environment happy-dom

import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BracketBadge } from "./bracket-badge";
import { ValueDelta } from "./value-delta";
import { Logo } from "./logo";
import { ShortcutFooter } from "./deckbuilder/shortcut-footer";
import { ImgWithFallback } from "./img-with-fallback";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ back: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import { NavLink } from "./nav-link";
import { BackLink } from "./back-link";

afterEach(() => cleanup());

describe("BracketBadge", () => {
  it("renders null bracket placeholder", () => {
    render(<BracketBadge bracket={null} prefix="Target" />);
    expect(screen.getByText(/Target/)).toBeInTheDocument();
  });

  it("renders bracket number and optional name", () => {
    render(<BracketBadge bracket={3} showName />);
    expect(screen.getByText(/B3/)).toBeInTheDocument();
    expect(screen.getByText(/Upgraded/)).toBeInTheDocument();
  });
});

describe("ValueDelta", () => {
  it("shows positive delta in green styling class", () => {
    const { container } = render(<ValueDelta value={12.5} />);
    expect(container.textContent).toContain("+");
    expect(container.textContent).toContain("12.50");
  });

  it("shows neutral zero state", () => {
    render(<ValueDelta value={0} />);
    expect(screen.getByText("$0.00")).toBeInTheDocument();
  });
});

describe("Logo", () => {
  it("renders accessible vault mark", () => {
    render(<Logo />);
    expect(screen.getByLabelText("MTG Vault")).toBeInTheDocument();
  });
});

describe("ShortcutFooter", () => {
  it("lists deckbuilder shortcuts", () => {
    render(<ShortcutFooter />);
    expect(screen.getByText("bracket")).toBeInTheDocument();
    expect(screen.getByText("snapshot")).toBeInTheDocument();
  });
});

describe("ImgWithFallback", () => {
  it("renders placeholder when src is missing", () => {
    render(<ImgWithFallback src={null} alt="Missing card" />);
    expect(screen.getByLabelText("Missing card")).toBeInTheDocument();
  });

  it("renders image when src is provided", () => {
    render(<ImgWithFallback src="https://example.com/card.jpg" alt="Card" />);
    expect(screen.getByAltText("Card")).toHaveAttribute(
      "src",
      "https://example.com/card.jpg",
    );
  });
});

describe("NavLink", () => {
  it("renders navigation link", () => {
    render(<NavLink href="/decks">Decks</NavLink>);
    expect(screen.getByRole("link", { name: "Decks" })).toHaveAttribute(
      "href",
      "/decks",
    );
  });
});

describe("BackLink", () => {
  it("renders a link when href is provided", () => {
    render(<BackLink href="/decks" label="Decks" />);
    expect(screen.getByRole("link", { name: /Decks/i })).toHaveAttribute(
      "href",
      "/decks",
    );
  });

  it("renders a button when href is omitted", () => {
    render(<BackLink label="Go back" />);
    expect(screen.getByRole("button", { name: /Go back/i })).toBeInTheDocument();
  });
});
