"use client";

import { useState } from "react";
import { load } from "../actions/vectordb";
import { useRouter } from "next/navigation";

export default function AddListing() {
  const router = useRouter();
  const [product, setProduct] = useState({
    title: "",
    description: "",
    category: "",
    price: "",
    brand: "",
    condition: "",
    color: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setProduct({ ...product, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await load(product);
    router.push("/");
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Add New Listing</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block">
            Title
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={product.title}
            onChange={handleChange}
            required
            className="border p-2 w-full"
          />
        </div>
        <div>
          <label htmlFor="description" className="block">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={product.description}
            onChange={handleChange}
            required
            className="border p-2 w-full"
          />
        </div>
        <div>
          <label htmlFor="category" className="block">
            Category
          </label>
          <input
            type="text"
            id="category"
            name="category"
            value={product.category}
            onChange={handleChange}
            required
            className="border p-2 w-full"
          />
        </div>
        <div>
          <label htmlFor="price" className="block">
            Price
          </label>
          <input
            type="text"
            id="price"
            name="price"
            value={product.price}
            onChange={handleChange}
            required
            className="border p-2 w-full"
          />
        </div>
        <div>
          <label htmlFor="brand" className="block">
            Brand
          </label>
          <input
            type="text"
            id="brand"
            name="brand"
            value={product.brand}
            onChange={handleChange}
            required
            className="border p-2 w-full"
          />
        </div>
        <div>
          <label htmlFor="condition" className="block">
            Condition
          </label>
          <input
            type="text"
            id="condition"
            name="condition"
            value={product.condition}
            onChange={handleChange}
            required
            className="border p-2 w-full"
          />
        </div>
        <div>
          <label htmlFor="color" className="block">
            Color
          </label>
          <input
            type="text"
            id="color"
            name="color"
            value={product.color}
            onChange={handleChange}
            required
            className="border p-2 w-full"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Add Listing
        </button>
      </form>
    </div>
  );
}
