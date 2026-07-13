import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProductCard from "./ProductCard";

function renderCard(product) {
  return render(
    <MemoryRouter>
      <ProductCard product={product} />
    </MemoryRouter>
  );
}

const baseProduct = {
  id: 42,
  name: "Basic White T-Shirt",
  category: "T-Shirts",
  base_price: 25,
  is_customizable: false,
  stock_quantity: 10,
  image_url: "https://example.com/shirt.jpg",
};

describe("ProductCard", () => {
  test("renders the product image with the product name as alt text", () => {
    renderCard(baseProduct);
    const img = screen.getByRole("img", { name: "Basic White T-Shirt" });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", baseProduct.image_url);
    expect(img).toHaveAttribute("alt", "Basic White T-Shirt");
  });

  test("the image link and the View Details button point to the exact same product route", () => {
    renderCard(baseProduct);
    const imageLink = screen.getByRole("link", { name: /view details for basic white t-shirt/i });
    expect(imageLink).toHaveAttribute("href", "/products/42");

    // The "View Details" control is a <button> that navigates via JS
    // (useNavigate), not a second <a> — so no invalid nested-link markup.
    const viewDetailsButton = screen.getByRole("button", { name: /view details/i });
    expect(viewDetailsButton).toBeInTheDocument();
    expect(viewDetailsButton.closest("a")).toBeNull();
  });

  test("cursor: pointer is applied to the clickable image link", () => {
    renderCard(baseProduct);
    const imageLink = screen.getByRole("link", { name: /view details for/i });
    expect(imageLink).toHaveStyle({ cursor: "pointer" });
  });

  test("an out-of-stock product still shows the image link — the badge does not remove it", () => {
    renderCard({ ...baseProduct, stock_quantity: 0 });
    expect(screen.getByText("Out of Stock")).toBeInTheDocument();
    const imageLink = screen.getByRole("link", { name: /view details for/i });
    expect(imageLink).toHaveAttribute("href", "/products/42");
    // The badge must never intercept the click underneath it.
    expect(screen.getByText("Out of Stock")).toHaveStyle({ pointerEvents: "none" });
  });

  test("a product with no image renders the 'No Image' fallback, still wrapped in the same link", () => {
    renderCard({ ...baseProduct, image_url: null, main_image_url: null });
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("No Image")).toBeInTheDocument();
    const imageLink = screen.getByRole("link", { name: /view details for/i });
    expect(imageLink).toHaveAttribute("href", "/products/42");
    expect(imageLink).toContainElement(screen.getByText("No Image"));
  });

  test("main_image_url takes precedence over the legacy image_url field", () => {
    renderCard({ ...baseProduct, main_image_url: "https://example.com/main.jpg" });
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/main.jpg");
  });

  test("does not make the entire card clickable — only the image link and the View Details button", () => {
    renderCard(baseProduct);
    // Exactly one link (the image) and one button (View Details); no
    // wrapping <a> around the whole card.
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
