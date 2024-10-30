"use client";

import { useState } from "react";
import { deleteProduct, searchProducts, Product } from "../actions/vectordb";
import Link from "next/link";

export default function ClientProductList({
  initialProducts,
}: {
  initialProducts: Product[];
}) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [query, setQuery] = useState("");

  const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (query.trim() === "") {
      // If query is empty, reset to initial products
      setProducts(initialProducts);
    } else {
      // Otherwise, perform the search
      const result = await searchProducts(query);
      setProducts(result);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteProduct(id);
    const updatedProducts = await searchProducts("");
    setProducts(updatedProducts);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Product Listings</h1>
      <form onSubmit={handleSearch} className="mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim() === "") {
              // Reset to initial products when input becomes empty
              setProducts(initialProducts);
            }
          }}
          placeholder="Search products..."
          className="border p-2 rounded mr-2"
        />
        <button
          type="submit"
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          Search
        </button>
      </form>
      <Link
        href="/add-listing"
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mb-4 inline-block"
      >
        Add New Listing
      </Link>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <div key={product.id} className="border p-4 rounded relative">
            <h2 className="text-xl font-semibold">{product.title}</h2>
            <p className="text-gray-600">{product.description}</p>
            <p className="text-lg font-bold mt-2">${product.price}</p>
            <div className="flex justify-between items-center mt-4">
              <Link
                href={`/edit-listing/${product.id}`}
                className="text-blue-500 hover:underline"
              >
                Edit
              </Link>
              <button
                onClick={() => handleDelete(product.id!)}
                className="text-red-500 hover:text-red-700"
                aria-label="Delete product"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
